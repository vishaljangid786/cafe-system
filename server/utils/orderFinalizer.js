const Transaction = require('../models/Transaction');
const Table = require('../models/Table');
const Order = require('../models/Order');
const { deductIngredientsFromRecipe } = require('../services/inventoryService');
const { getSettings } = require('./settings');
const { getIO } = require('../config/socket');

/**
 * Finalizes an order, records revenue, and deducts ingredients.
 * @param {Object} order - The populated order object.
 * @param {Object} user - The user performing the action.
 * @returns {Promise<Object>} - The finalized order.
 */
const finalizeOrder = async (order, user) => {
  // Atomically claim the order so two concurrent /complete (or serve+complete)
  // calls can't both finalize it and record REVENUE twice — only the request
  // that flips isBilled false->true proceeds.
  const now = new Date();
  // Configurable tax/billing for this branch (falls back to defaults).
  const settings = await getSettings(order.branch);
  const gstFraction = (Number(settings?.tax?.gstRate) || 0) / 100;
  const svcFraction = (Number(settings?.billing?.serviceChargeRate) || 0) / 100;
  const roundBill = settings?.billing?.roundBill !== false;
  // Multi-stage pipeline: derive the bill the same way generateOrderBill does so
  // the stored taxAmount / serviceCharge / grandTotal agree with the printed bill,
  // and a still-unpaid order is settled at the real amount the customer pays
  // (subtotal - discount + service + GST) — not the GST-exclusive sales value.
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, isBilled: { $ne: true } },
    [
      {
        $set: {
          isBilled: true,
          status: 'COMPLETED',
          completedAt: now,
          statusHistory: { $concatArrays: [{ $ifNull: ['$statusHistory', []] }, [{ status: 'COMPLETED', timestamp: now, updatedBy: user._id }]] },
          _taxable: { $max: [0, { $subtract: ['$totalAmount', { $ifNull: ['$discountAmount', 0] }] }] },
        },
      },
      { $set: { serviceCharge: { $round: [{ $multiply: ['$_taxable', svcFraction] }, 2] } } },
      { $set: { taxAmount: { $round: [{ $multiply: [{ $add: ['$_taxable', '$serviceCharge'] }, gstFraction] }, 2] } } },
      {
        $set: {
          grandTotal: {
            $let: {
              vars: { gt: { $add: ['$_taxable', '$serviceCharge', '$taxAmount'] } },
              in: roundBill ? { $round: ['$$gt', 0] } : '$$gt',
            },
          },
        },
      },
      {
        // A still-unpaid order is assumed settled at completion (amountPaid =
        // grandTotal). An order already partly settled (e.g. a gift card tendered
        // before completion) keeps its amountPaid.
        $set: {
          amountPaid: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, '$grandTotal', '$amountPaid'] },
        },
      },
      {
        // Derive the real payment status from what's actually paid vs the true
        // grandTotal — so a gift card that only covered the subtotal correctly
        // reads 'partial' (GST/service still owed), never a false 'paid'.
        $set: {
          paymentStatus: {
            $cond: [
              { $gte: ['$amountPaid', '$grandTotal'] }, 'paid',
              { $cond: [{ $gt: ['$amountPaid', 0] }, 'partial', 'unpaid'] },
            ],
          },
        },
      },
      { $unset: '_taxable' },
    ],
    { new: true, updatePipeline: true }
  );
  if (!claimed) {
    throw new Error('This order has already been finalized and billed.');
  }

  order.status = 'COMPLETED';
  order.completedAt = now;
  order.isBilled = true;
  order.paymentStatus = claimed.paymentStatus;
  order.amountPaid = claimed.amountPaid;
  order.serviceCharge = claimed.serviceCharge;
  order.taxAmount = claimed.taxAmount;
  order.grandTotal = claimed.grandTotal;

  // Calculate gross profit from items
  const grossProfit = order.items.reduce((acc, item) => {
    const price = Number(item.price || 0);
    const costPrice = Number(item.costPrice || 0);
    const qty = Number(item.quantity || 0);
    return acc + ((price - costPrice) * qty);
  }, 0);

  // Net Profit = item gross margin − discount + service charge. Service charge is
  // pure income (no cost) so it belongs in profit; GST is a pass-through liability
  // and is excluded from BOTH profit and revenue (see revenue basis at the txn below).
  const serviceCharge = Number(order.serviceCharge) || 0;
  const taxAmount = Number(order.taxAmount) || 0;
  const totalProfit = grossProfit - (Number(order.discountAmount) || 0) + serviceCharge;

  // Revenue is recorded GST-EXCLUSIVE, matching the Order schema's stated design
  // ("Revenue itself stays GST-exclusive"). grandTotal includes GST (money owed to
  // the government, not earned income); booking it as revenue overstated revenue
  // and profit. Cash collected / cash-drawer reconciliation still use the
  // GST-inclusive grandTotal + amountPaid separately.
  const revenueAmount = Math.max(0, Number(order.grandTotal || order.totalAmount || 0) - taxAmount);

  // Deduct ingredients FIRST so a deduction failure surfaces before we record
  // revenue. Previously the false return was swallowed, which could leave a
  // REVENUE transaction recorded with no corresponding inventory deduction.
  // The isBilled claim above is already committed, so a thrown error here will
  // not double-bill on retry — it just prevents recording unbacked revenue.
  const deducted = await deductIngredientsFromRecipe(order, order.branch);
  if (!deducted) {
    console.error(`[orderFinalizer] Ingredient deduction failed for order ${order._id}; aborting revenue record.`);
    throw new Error('Failed to deduct ingredients for this order. Revenue was not recorded.');
  }

  // Create Transaction (only after ingredients are successfully deducted)
  const transaction = await Transaction.create({
    locationId: order.branch,
    type: 'REVENUE',
    source: 'ORDER',
    orderId: order._id,
    staffId: user._id,
    createdBy: user._id,
    paymentType: order.paymentType || 'CASH',
    title: `Order #${order._id.toString().slice(-6).toUpperCase()}`,
    category: 'Sales',
    totalAmount: revenueAmount,
    totalProfit: isNaN(totalProfit) ? 0 : totalProfit,
    date: new Date(),
    status: 'approved',
    orders: order.items.map(i => ({
      menuItemId: i.menuItem?._id || i.menuItem,
      itemName: i.itemName || 'Item',
      quantity: Number(i.quantity || 0),
      price: Number(i.price || 0),
      costPrice: Number(i.costPrice || 0)
    }))
  });

  // Reconcile a reservation advance against this bill. The advance was a
  // pre-payment toward the meal; now that the full bill is recorded as revenue,
  // reverse the advance-income entry so the same money isn't counted twice. Done
  // once per reservation.
  if (order.reservationId) {
    try {
      const Reservation = require('../models/Reservation');
      const reservation = await Reservation.findById(order.reservationId);
      if (reservation && !reservation.advanceApplied && reservation.expenseId) {
        await Transaction.updateOne({ expenseId: reservation.expenseId }, { $set: { status: 'rejected' } });
        reservation.advanceApplied = true;
        await reservation.save();
      }
    } catch (e) {
      console.error('[orderFinalizer] reservation advance reconcile failed:', e.message);
    }
  }

  // Decrement active orders count on table (dine-in only; takeaway/delivery
  // have no table).
  const updatedTable = order.table
    ? await Table.findByIdAndUpdate(
        order.table,
        { $inc: { activeOrdersCount: -1 } },
        { new: true, runValidators: false }
      )
    : null;

  // Auto-clear the table when no active orders remain. Fully reset occupancy so a
  // freed table doesn't linger as "booked"/occupied with stale guest details
  // (previously only uploadBill reset isBooked, so completing the last order via
  // the kitchen flow left the table stuck on "booked").
  if (updatedTable && updatedTable.activeOrdersCount <= 0) {
    updatedTable.status = 'available';
    updatedTable.activeOrdersCount = 0; // Guard against negative numbers
    updatedTable.isBooked = false;
    updatedTable.numberOfPeople = 0;
    updatedTable.customerName = '';
    await updatedTable.save();
  }

  // A completed CASH order is cash collected into the register — nudge any open
  // cash-drawer view for this branch to refetch in realtime. Best-effort: a
  // realtime failure must never break finalization.
  if (order.paymentType === 'CASH') {
    try {
      getIO().to(`branch_${order.branch}`).emit('cashdrawer:update', { locationId: String(order.branch) });
    } catch (_) { /* realtime is best-effort */ }
  }

  // status/isBilled were persisted atomically above — no second save needed.
  return order;
};

module.exports = { finalizeOrder };
