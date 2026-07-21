const mongoose = require('mongoose');
const Order = require('../models/Order');
const Table = require('../models/Table');
const Settings = require('../models/Settings');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const BranchStock = require('../models/BranchStock');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const { enforceLocationAccess, clampLimit, scopedLocationId, endOfDay, escapeRegex } = require('../utils/accessControl');
const { requireRecord, assertCanDelete, announceDeletion } = require('../utils/deleteGuard');
const { logActivity } = require('../utils/auditLogger');
const { normalizePhone } = require('../utils/phone');
const sendNotification = require('../utils/sendNotification');
const { getSettings } = require('../utils/settings');
const { notifyCustomer } = require('../services/customerNotify');
const OrderService = require('../services/orderService');

const shortOrderId = (id) => id.toString().slice(-6).toUpperCase();

const ensureOrderAccess = (req, res, order, message = 'Permission denied to this order') => {
  enforceLocationAccess(req, res, order.branch, message);
};

// @desc    Create a new order
const createOrder = asyncHandler(async (req, res) => {
  if (req.user.role === 'chef') {
    res.status(403);
    throw new Error('Only staff can create orders');
  }

  const { branch: requestedBranch, table: tableId, items, customerPhone, customerName, couponId, paymentType, orderType: rawType } = req.body;
  const orderType = ['dine-in', 'takeaway', 'delivery'].includes(rawType) ? rawType : 'dine-in';
  const branch = ['staff', 'chef'].includes(req.user.role)
    ? req.user.assignedLocation
    : (requestedBranch || (req.user.role === 'branch_admin' ? req.user.assignedLocation : null));

  if (!branch) {
    res.status(400);
    throw new Error('Branch is required');
  }

  enforceLocationAccess(req, res, branch, 'You do not have permission to create orders for this branch');

  // Table is required for dine-in only. Takeaway/delivery orders have no table.
  if (orderType === 'dine-in') {
    if (!tableId) {
      res.status(400);
      throw new Error('A table is required for a dine-in order');
    }
    const table = await Table.findOne({ _id: tableId, locationId: branch });
    if (!table) {
      res.status(403);
      throw new Error('Selected table does not belong to this branch');
    }
  }

  // New-customer intro discount for POS orders, computed SERVER-SIDE from the
  // phone the cashier entered — the same rule the QR flow applies, so a walk-in
  // and a self-order get identical treatment. Best-effort: a CRM hiccup must
  // never stop an order being taken.
  let serverDiscountAmount = 0;
  try {
    const phone = normalizePhone(customerPhone);
    if (phone.length >= 10) {
      const Customer = require('../models/Customer');
      const Location = require('../models/Location');
      const [known, branchDoc] = await Promise.all([
        Customer.findOne({ phone }).lean(),
        Location.findById(branch).select('cafe').lean(),
      ]);
      const membership = known && branchDoc?.cafe
        ? (known.memberships || []).find((m) => String(m.cafe) === String(branchDoc.cafe))
        : null;
      // Unknown numbers are new customers too — absence of a membership means
      // they have never ordered at this cafe.
      const eligible = !membership || (membership.status === 'new' && !membership.newCustomerDiscountUsed);
      if (eligible) {
        const { getSettings } = require('../utils/settings');
        const crm = (await getSettings(branch)).crm || {};
        if (crm.newCustomerDiscountEnabled !== false && Number(crm.newCustomerDiscountPercent) > 0) {
          const subtotal = (items || []).reduce(
            (acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0),
            0
          );
          // The service recomputes the authoritative subtotal from the menu; this
          // is only used when the client sent prices, so guard on a sane value.
          if (subtotal > 0 && subtotal >= (Number(crm.newCustomerMinOrder) || 0)) {
            let amount = (subtotal * Number(crm.newCustomerDiscountPercent)) / 100;
            if (crm.newCustomerMaxDiscount != null) {
              amount = Math.min(amount, Number(crm.newCustomerMaxDiscount) || 0);
            }
            serverDiscountAmount = Number(Math.max(0, amount).toFixed(2));
          }
        }
      }
    }
  } catch (err) {
    console.error('[orderController] intro-discount resolution failed:', err.message);
  }

  let order;
  try {
    order = await OrderService.createOrder({
      branch,
      tableId: orderType === 'dine-in' ? tableId : null,
      items,
      customerPhone,
      customerName,
      serverDiscountAmount,
      // NOTE: a client-supplied discountAmount is deliberately NOT forwarded. The
      // service is the sole price authority and derives every discount from the
      // applied coupon, so passing it through only created the illusion that a
      // manual discount field worked (it was silently discarded downstream).
      couponId: couponId || null,
      paymentType: paymentType || 'CASH',
      orderType,
      userId: req.user._id
    });
  } catch (err) {
    // Business-rule violations from the service (insufficient stock, item
    // unavailable, "no stock record in this branch", coupon invalid, missing
    // required modifier, the 10-second per-table guard, …) are thrown as plain
    // `Error`s with no statusCode, so they default to 500 and get masked as the
    // generic "Something went wrong. Please try again later." in production.
    // Re-tag those as 400 so the real, actionable reason reaches the staff member.
    // Genuine system faults (TypeError, MongoServerError, ValidationError, …)
    // keep their own name and stay 500 / their specific handling.
    if (!err.statusCode && err.name === 'Error') {
      err.statusCode = 400;
    }
    throw err;
  }

  await sendNotification({
    title: 'New Order',
    message: `Order #${shortOrderId(order._id)} was placed by ${req.user.name}.`,
    type: 'order_action',
    performedByUser: req.user,
    locationId: order.branch || branch,
  });

  res.status(201).json({ success: true, data: order });
});

// @desc    Get orders
const getOrders = asyncHandler(async (req, res) => {
  const { status, orderType, branchId, cafeId, tableId, isBilled, createdBy, startDate, endDate, search } = req.query;
  const filter = {};

  const VALID_ORDER_STATUSES = ['AWAITING_APPROVAL', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
  if (status && VALID_ORDER_STATUSES.includes(status)) filter.status = status;
  // Filter by order type (Dine-in / Takeaway / Delivery).
  const VALID_ORDER_TYPES = ['dine-in', 'takeaway', 'delivery'];
  if (orderType && VALID_ORDER_TYPES.includes(orderType)) filter.orderType = orderType;
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ customerName: re }, { customerPhone: re }];
  }
  if (tableId) filter.table = tableId;
  if (isBilled !== undefined) filter.isBilled = isBilled === 'true';
  if (createdBy) filter.createdBy = createdBy;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = endOfDay(endDate);
  }

  const branch = scopedLocationId(req, branchId);
  if (branch) filter.branch = branch;

  // Optional cafe filter: narrow to the branches owned by that cafe, intersected
  // with the access scope above so it can only ever NARROW what the user may see.
  if (cafeId && mongoose.isValidObjectId(cafeId)) {
    const Location = require('../models/Location');
    const cafeBranches = (await Location.find({ cafe: cafeId }).select('_id').lean())
      .map((b) => b._id.toString());
    let allowed = cafeBranches;
    if (branch && branch.$in) {
      const set = new Set(branch.$in.map((x) => x.toString()));
      allowed = cafeBranches.filter((b) => set.has(b));
    } else if (branch) {
      allowed = cafeBranches.filter((b) => b === branch.toString());
    }
    filter.branch = { $in: allowed };
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  const total = await Order.countDocuments(filter);

  const orders = await Order.find(filter)
    .populate({ path: 'branch', select: 'name city cafe', populate: { path: 'cafe', select: 'name' } })
    .populate('table', 'tableNumber')
    .populate('createdBy', 'name deletedAt')
    .populate('assignedChef', 'name deletedAt')
    .populate('coupon', 'code discountType discountValue')
    .populate('items.menuItem', 'name price dietaryType category')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json({ 
    success: true, 
    count: orders.length, 
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
    data: orders 
  });
});

// @desc    Update order status
const updateOrderStatus = asyncHandler(async (req, res) => {
  req.body = req.body || {};
  const { status } = req.body;
  const orderId = req.params.id;
  
  // Preliminary check for existence and access
  const existingOrder = req.omsOrder || await Order.findById(orderId);
  if (!existingOrder) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, existingOrder);

  const updatedOrder = await OrderService.updateStatus(orderId, status, req.user._id, req.user.role);

  res.json({ success: true, data: updatedOrder });
});

// @desc    Modify order items
const updateOrderItems = asyncHandler(async (req, res) => {
  const { items, totalAmount } = req.body;
  const orderId = req.params.id;
  const order = await Order.findById(orderId);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  ensureOrderAccess(req, res, order);

  const updatedOrder = await OrderService.updateItems(orderId, items, req.user._id);

  await logActivity(
    req.user,
    'ORDER_UPDATE_ITEMS',
    `Updated items for Order #${order._id.toString().slice(-6).toUpperCase()}`,
    req,
    { orderId: order._id, locationId: order.branch, totalAmount }
  );

  res.json({ success: true, data: updatedOrder });
});

// @desc    Reject order with reason
const rejectOrder = asyncHandler(async (req, res) => {
  if (req.user.role !== 'chef') {
    res.status(403);
    throw new Error('Only chefs can reject orders');
  }
  const orderId = req.params.id;
  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);

  const { rejectReason } = req.body || {};
  const updatedOrder = await OrderService.rejectOrder(orderId, rejectReason, req.user._id);

  // Let the seniors know an order was rejected (routes up the hierarchy).
  await sendNotification({
    title: 'Order Rejected',
    message: `Order #${shortOrderId(order._id)} was rejected by ${req.user.name}${rejectReason ? `: "${rejectReason}"` : ''}.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: order.branch,
  });

  res.json({ success: true, data: updatedOrder });
});

// @desc    Cancel order
const cancelOrder = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);
  
  if (!['admin', 'super_admin', 'branch_admin'].includes(req.user.role)) {
    res.status(403);
    throw new Error('No permission to cancel orders');
  }

  const updatedOrder = await OrderService.cancelOrder(orderId, req.user._id);

  // Notify the seniors that an order was cancelled (routes up the hierarchy).
  await sendNotification({
    title: 'Order Cancelled',
    message: `Order #${shortOrderId(order._id)} was cancelled by ${req.user.name}.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: order.branch,
  });

  res.json({ success: true, data: updatedOrder });
});

// @desc    Delete order
// @route   DELETE /api/orders/:id
const deleteOrder = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const order = requireRecord(res, await Order.findById(orderId), 'Order');

  // The route already applied checkAction('orders.delete'), but middleware cannot
  // know WHICH order the id resolves to. Re-checking here — after the document is
  // loaded — is what stops an admin of branch A deleting branch B's order, and it
  // survives the controller being reached by any future route or internal call.
  assertCanDelete(req, res, {
    resource: 'order',
    actionKey: 'orders.delete',
    locationId: order.branch,
  });

  // A COMPLETED order is a settled sale: the money was collected and booked as
  // revenue. OrderService.deleteOrder refuses it outright (existing rule, kept as
  // is) — surfacing it here turns that service-level throw into a specific 400
  // that names the reversible alternative instead of a generic failure.
  if (order.status === 'COMPLETED') {
    res.status(400);
    throw new Error(
      `Order #${shortOrderId(order._id)} is completed and its revenue is already in the books. Refund it instead of deleting it — a refund reverses the revenue and keeps the sale on record.`
    );
  }

  // Cascade decision: a revenue Transaction points back at this order via `orderId`,
  // so deleting the order would leave money in the books referencing a sale nobody
  // can open. Chosen handling — REFUSE for everyone except a super_admin (refunding
  // is the reversible path and keeps the audit trail), and when a super_admin does
  // force it, DELETE the paired transactions with the order rather than orphan them,
  // recording the erased amount in the audit entry so the money is still traceable.
  // Already-rejected rows are ignored: they are out of the books (that is what a
  // refund does) and carry no live revenue.
  const Transaction = require('../models/Transaction');
  const revenueTxns = await Transaction.find({
    orderId: order._id,
    type: 'REVENUE',
    status: { $ne: 'rejected' },
  }).select('_id totalAmount').lean();

  if (revenueTxns.length && req.user.role !== 'super_admin') {
    res.status(400);
    throw new Error(
      `Order #${shortOrderId(order._id)} has been billed and its revenue is recorded. Refund it first (that reverses the revenue), then it can be deleted.`
    );
  }

  // Active (not cancelled/rejected/completed) orders are safe to delete: the service
  // restores the reserved stock, returns the coupon use and decrements the table's
  // active-order counter, so nothing is left dangling behind them.
  await OrderService.deleteOrder(orderId, req.user.role);

  const erasedRevenue = revenueTxns.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);
  if (revenueTxns.length) {
    await Transaction.deleteMany({ _id: { $in: revenueTxns.map((t) => t._id) } });
  }

  await announceDeletion(req, {
    resource: 'Order',
    name: `#${shortOrderId(order._id)}`,
    locationId: order.branch,
    action: 'ORDER_DELETE',
    type: 'order_action',
    priority: 'high',
    detail: revenueTxns.length
      ? `Its booked revenue (${erasedRevenue}) was removed with it.`
      : '',
    metadata: {
      orderId: String(order._id),
      status: order.status,
      totalAmount: order.totalAmount,
      revenueRemoved: erasedRevenue,
    },
  });

  res.json({ success: true, message: 'Order deleted from system' });
});

// @desc    Add chef note
const addChefNote = asyncHandler(async (req, res) => {
  if (req.user.role !== 'chef') {
    res.status(403);
    throw new Error('Only chefs can add notes');
  }
  
  const orderId = req.params.id;
  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);

  const { chefNote } = req.body || {};
  const updatedOrder = await OrderService.addChefNote(orderId, chefNote, req.user);

  res.json({ success: true, data: updatedOrder });
});

// Specialized Status Wrappers
const acceptOrder = asyncHandler(async (req, res) => {
  req.body.status = 'ACCEPTED';
  await updateOrderStatus(req, res);
});

const startPreparing = asyncHandler(async (req, res) => {
  req.body.status = 'PREPARING';
  await updateOrderStatus(req, res);
});

const markReady = asyncHandler(async (req, res) => {
  req.body.status = 'READY';
  await updateOrderStatus(req, res);
});

// @desc    Mark as SERVED
const completeOrder = asyncHandler(async (req, res) => {
  req.body.status = 'COMPLETED';
  await updateOrderStatus(req, res);
});

// @desc    Force complete order
const forceCompleteOrder = asyncHandler(async (req, res) => {
  // Authorization is already handled by middleware in routes
  req.body.status = 'COMPLETED';
  await updateOrderStatus(req, res);
});

// @desc    Record a payment against an order (cash collected / partial / credit)
// @route   PATCH /api/orders/:id/payment
const recordPayment = asyncHandler(async (req, res) => {
  const { amountPaid, paymentType, paymentStatus } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);

  // A refunded order's payment must not be rewritten — the refund already zeroed
  // amountPaid and reversed its revenue.
  if (order.isRefunded) {
    res.status(400);
    throw new Error('Cannot record a payment against a refunded order');
  }
  // Gift-card settlements are owned by the gift-card redeem/refund flow, which keeps
  // the card ledger and the order's amountPaid in sync. Overwriting amountPaid here
  // (an absolute set, not an increment) would erase the gift-card contribution and
  // mis-attribute it to cash in the drawer.
  if (order.paymentType === 'GIFT_CARD') {
    res.status(400);
    throw new Error('This order was settled with a gift card. Use the gift-card flow to adjust its payment.');
  }
  // Nothing to record on an already fully-paid order; blocking prevents an accidental
  // overwrite that would corrupt cash-drawer reconciliation.
  if (order.paymentStatus === 'paid') {
    res.status(400);
    throw new Error('This order is already fully paid');
  }

  if (amountPaid !== undefined) {
    const paid = Number(amountPaid);
    if (!Number.isFinite(paid) || paid < 0) {
      res.status(400);
      throw new Error('Amount paid must be a non-negative number');
    }
    order.amountPaid = paid;
  }
  if (paymentType && ['CASH', 'CARD', 'UPI', 'ONLINE', 'GIFT_CARD', 'OTHER'].includes(paymentType)) {
    order.paymentType = paymentType;
  }

  // Derive the truthful status from the recorded amount, then honour an explicit
  // status ONLY when it doesn't over-claim payment. A client must never be able to
  // mark an order 'paid' (or 'partial') while it is actually underpaid — that would
  // corrupt cash-drawer reconciliation, which sums collected cash from these orders.
  // Compare against the true amount owed: grandTotal (subtotal − discount +
  // service + GST) once it's been computed at completion, else the pre-completion
  // subtotal. Using totalAmount alone would mark an order 'paid' when only the
  // GST/service-exclusive subtotal was collected, under-counting cash owed.
  const total = Number(order.grandTotal) > 0 ? Number(order.grandTotal) : (Number(order.totalAmount) || 0);
  const paid = Number(order.amountPaid) || 0;
  const derived = paid <= 0 ? 'unpaid' : (paid < total ? 'partial' : 'paid');
  const rank = { unpaid: 0, partial: 1, paid: 2 };
  if (paymentStatus && rank[paymentStatus] !== undefined && rank[paymentStatus] <= rank[derived]) {
    order.paymentStatus = paymentStatus;
  } else {
    order.paymentStatus = derived;
  }

  await order.save();

  const io = getIO();
  io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: order.status });

  // Tell the customer their order is ready (best-effort SMS/WhatsApp).
  if (order.status === 'READY' && order.customerPhone) {
    notifyCustomer(order.customerPhone, `Hi${order.customerName ? ` ${order.customerName}` : ''}! Your order #${shortOrderId(order._id)} is ready. Thank you for visiting.`, { type: 'order-ready' });
  }

  await sendNotification({
    title: 'Payment Recorded',
    message: `Payment recorded for order #${shortOrderId(order._id)} (${order.paymentStatus}) by ${req.user.name}.`,
    type: 'order_action',
    performedByUser: req.user,
    locationId: order.branch,
  });

  res.json({ success: true, data: order });
});

// @desc    Confirm a QR/self-order's payment and release it to the kitchen
// @route   PATCH /api/orders/:id/approve-payment
// @access  Private (orders.approve — staff / branch_admin / admin / super_admin)
const approvePayment = asyncHandler(async (req, res) => {
  const { method, amountPaid, upiRef, note } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);

  let updated;
  try {
    updated = await OrderService.approvePayment(
      order._id,
      { method, amountPaid, upiRef, note, markPaid: true },
      req.user
    );
  } catch (err) {
    if (!err.statusCode && err.name === 'Error') err.statusCode = 400;
    throw err;
  }

  await sendNotification({
    title: 'Self-Order Confirmed',
    message: `Payment confirmed for order #${shortOrderId(updated._id)} (${updated.paymentType}) by ${req.user.name}. Sent to kitchen.`,
    type: 'order_action',
    performedByUser: req.user,
    locationId: updated.branch,
  });

  res.json({ success: true, data: updated });
});

// @desc    Decline a QR/self-order awaiting approval (payment not received)
// @route   PATCH /api/orders/:id/decline
// @access  Private (orders.approve)
const declineOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);

  let updated;
  try {
    updated = await OrderService.declinePublicOrder(order._id, reason, req.user);
  } catch (err) {
    if (!err.statusCode && err.name === 'Error') err.statusCode = 400;
    throw err;
  }

  await sendNotification({
    title: 'Self-Order Declined',
    message: `Order #${shortOrderId(updated._id)} was declined by ${req.user.name}${reason ? ` (${reason})` : ''}.`,
    type: 'order_action',
    performedByUser: req.user,
    locationId: updated.branch,
  });

  res.json({ success: true, data: updated });
});

// @desc    Re-order a rejected/cancelled order (places a fresh order from its items)
// @route   POST /api/orders/:id/reorder
const reorderOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);
  if (!['REJECTED', 'CANCELLED'].includes(order.status)) {
    res.status(400);
    throw new Error('Only a rejected or cancelled order can be re-ordered');
  }

  // Re-run the full create flow (stock deduction, coupon, reservation link) from
  // the original items — gives staff a one-tap recovery after a chef rejection.
  // Carry the modifiers across too — the service re-validates them against the
  // menu item's groups, so the retried order keeps its paid add-ons instead of
  // being silently rebuilt at base price.
  const items = order.items.map((i) => ({ menuItem: i.menuItem, quantity: i.quantity, notes: i.notes, modifiers: i.modifiers }));
  const newOrder = await OrderService.createOrder({
    branch: order.branch,
    tableId: order.table || null,
    items,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    orderType: order.orderType || 'dine-in',
    userId: req.user._id,
  });

  res.status(201).json({ success: true, data: newOrder });
});

// @desc    Move an order to a different table (same branch)
// @route   PATCH /api/orders/:id/move-table
const moveOrderTable = asyncHandler(async (req, res) => {
  const { tableId } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);
  if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
    res.status(400);
    throw new Error('Cannot move a finished order');
  }

  const target = await Table.findOne({ _id: tableId, locationId: order.branch });
  if (!target) {
    res.status(404);
    throw new Error('Target table not found in this branch');
  }
  const oldTableId = order.table;
  if (String(oldTableId) === String(tableId)) {
    res.status(400);
    throw new Error('Order is already on this table');
  }

  order.table = tableId;
  await order.save();

  await Table.findByIdAndUpdate(tableId, { status: 'ongoing', $inc: { activeOrdersCount: 1 } }, { runValidators: false });
  if (oldTableId) {
    const oldT = await Table.findByIdAndUpdate(oldTableId, { $inc: { activeOrdersCount: -1 } }, { new: true, runValidators: false });
    if (oldT && oldT.activeOrdersCount <= 0) {
      oldT.activeOrdersCount = 0;
      oldT.status = 'available';
      oldT.isBooked = false;
      oldT.numberOfPeople = 0;
      oldT.customerName = '';
      await oldT.save();
    }
  }

  const io = getIO();
  io.to(`branch_${order.branch}`).emit('table:update', { tableId, action: 'move' });

  await sendNotification({
    title: 'Order Moved',
    message: `Order #${shortOrderId(order._id)} was moved to another table by ${req.user.name}.`,
    type: 'order_action',
    performedByUser: req.user,
    locationId: order.branch,
  });

  res.json({ success: true, data: order });
});

// @desc    Split an order — move selected item quantities into a new sibling order
//          (same table) so two customers can be billed/paid separately.
// @route   POST /api/orders/:id/split
const splitOrder = asyncHandler(async (req, res) => {
  const { items: splitItems } = req.body || {};
  if (!Array.isArray(splitItems) || splitItems.length === 0) {
    res.status(400);
    throw new Error('Provide the items (with quantities) to split off');
  }
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);
  if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
    res.status(400);
    throw new Error('Cannot split a finished order');
  }

  // Build the moved-out items from the original, validating quantities.
  const movedItems = [];
  for (const s of splitItems) {
    const orig = order.items.id(s.itemId);
    if (!orig) {
      res.status(400);
      throw new Error('One of the split items is not in this order');
    }
    const qty = Number(s.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > orig.quantity) {
      res.status(400);
      throw new Error(`Invalid split quantity for ${orig.itemName}`);
    }
    movedItems.push({
      menuItem: orig.menuItem,
      itemName: orig.itemName,
      price: orig.price,
      costPrice: orig.costPrice,
      quantity: qty,
      notes: orig.notes,
      status: orig.status,
    });
    // Reduce or remove from the original.
    if (qty === orig.quantity) orig.deleteOne();
    else orig.quantity -= qty;
  }

  if (order.items.length === 0) {
    res.status(400);
    throw new Error('Cannot split off every item — nothing would remain on the original order');
  }

  const recalc = (its) => its.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
  const remainingTotal = recalc(order.items);
  const movedTotal = recalc(movedItems);
  const combinedTotal = remainingTotal + movedTotal;

  // Allocate any order-level discount proportionally by subtotal so splitting doesn't
  // silently shrink the customer's total discount. Previously the whole discount stayed
  // on the original (and the new order got none), so the combined discount could drop.
  // Each part is clamped to its own subtotal, and the two parts always sum to the
  // original discount.
  const originalDiscount = Number(order.discountAmount) || 0;
  let movedDiscount = combinedTotal > 0 ? Math.round((originalDiscount * movedTotal / combinedTotal) * 100) / 100 : 0;
  movedDiscount = Math.min(movedDiscount, movedTotal);
  let remainingDiscount = Math.min(originalDiscount - movedDiscount, remainingTotal);
  if (remainingDiscount < 0) remainingDiscount = 0;

  order.totalAmount = remainingTotal;
  order.discountAmount = remainingDiscount;

  // Create the sibling BEFORE persisting the reduced original. The reductions
  // above are in-memory only until save(), so a failed create leaves the original
  // untouched in the database. Previously the original was saved first, meaning a
  // failure here destroyed the moved quantities — reduced on the original and
  // never created anywhere else. If the original's save then fails, the sibling is
  // deleted so the two can never diverge.
  const newOrder = await Order.create({
    branch: order.branch,
    table: order.table,
    orderType: order.orderType,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    items: movedItems,
    totalAmount: movedTotal,
    discountAmount: movedDiscount,
    createdBy: req.user._id,
    status: order.status,
    statusHistory: [{ status: order.status, timestamp: new Date(), updatedBy: req.user._id }],
  });

  try {
    await order.save();
  } catch (err) {
    await Order.deleteOne({ _id: newOrder._id }).catch(() => {});
    throw err;
  }

  // The split adds one more active order to the table.
  if (order.table) {
    await Table.findByIdAndUpdate(order.table, { $inc: { activeOrdersCount: 1 } }, { runValidators: false });
  }

  const io = getIO();
  io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: order.status });

  await sendNotification({
    title: 'Order Split',
    message: `Order #${shortOrderId(order._id)} was split into #${shortOrderId(newOrder._id)} by ${req.user.name}.`,
    type: 'order_action',
    performedByUser: req.user,
    locationId: order.branch,
  });

  res.json({ success: true, data: { original: order, newOrder } });
});

// @desc    Update a single order item's kitchen status (per-item KOT)
// @route   PATCH /api/orders/:id/item-status
const updateItemStatus = asyncHandler(async (req, res) => {
  const { itemId, status } = req.body || {};
  if (!['pending', 'preparing', 'ready', 'served'].includes(status)) {
    res.status(400);
    throw new Error('Invalid item status');
  }
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);

  if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
    res.status(400);
    throw new Error(`Cannot change items of a ${order.status} order`);
  }

  const item = order.items.id(itemId);
  if (!item) {
    res.status(404);
    throw new Error('Order item not found');
  }
  item.status = status;

  const now = new Date();
  // Derive the order-level status from item progress so staff still get a single
  // "order ready" signal. First item into prep moves an ACCEPTED order to PREPARING;
  // once every item is ready/served the order becomes READY.
  const allDone = order.items.every((i) => ['ready', 'served'].includes(i.status));
  if (allDone && ['PLACED', 'ACCEPTED', 'PREPARING'].includes(order.status)) {
    order.status = 'READY';
    order.statusHistory.push({ status: 'READY', timestamp: now, updatedBy: req.user._id });
  } else if (status === 'preparing' && ['PLACED', 'ACCEPTED'].includes(order.status)) {
    order.status = 'PREPARING';
    order.statusHistory.push({ status: 'PREPARING', timestamp: now, updatedBy: req.user._id });
  }
  await order.save();

  const io = getIO();
  io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: order.status });
  if (order.status === 'READY') {
    io.to(`branch_${order.branch}_staff`).emit('order:ready', { orderId: order._id, message: 'Order Ready!' });
  }

  res.json({ success: true, data: order });
});

// @desc    GST collected report (sum of tax over completed, non-refunded orders)
// @route   GET /api/orders/gst-report
const getGstReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, branchId } = req.query;
  const match = { status: 'COMPLETED', isRefunded: { $ne: true } };

  const branchScope = scopedLocationId(req, branchId);
  if (branchScope) {
    if (typeof branchScope === 'object' && branchScope.$in) {
      match.branch = { $in: branchScope.$in.map(id => new mongoose.Types.ObjectId(id.toString())) };
    } else {
      match.branch = new mongoose.Types.ObjectId(branchScope.toString());
    }
  }
  if (startDate || endDate) {
    match.completedAt = {};
    if (startDate) match.completedAt.$gte = new Date(startDate);
    if (endDate) match.completedAt.$lte = endOfDay(endDate);
  }

  const agg = await Order.aggregate([
    { $match: match },
    { $group: {
        _id: null,
        gstCollected: { $sum: { $ifNull: ['$taxAmount', 0] } },
        // Taxable base must match how finalizeOrder charges GST: (totalAmount − discount)
        // PLUS serviceCharge. Omitting serviceCharge made taxableRevenue × rate fail to
        // reconcile with gstCollected whenever a service charge was configured.
        taxableRevenue: { $sum: { $add: [
          { $max: [0, { $subtract: ['$totalAmount', { $ifNull: ['$discountAmount', 0] }] }] },
          { $ifNull: ['$serviceCharge', 0] },
        ] } },
        orders: { $sum: 1 },
    } },
  ]);
  const r = agg[0] || { gstCollected: 0, taxableRevenue: 0, orders: 0 };
  // Show the configured rate for the requested branch (global default otherwise).
  const settings = await getSettings(branchId && branchId !== 'all' ? branchId : null);
  const rate = Number(settings?.tax?.gstRate) || 0;
  res.json({ success: true, data: { gstCollected: r.gstCollected, taxableRevenue: r.taxableRevenue, orders: r.orders, rate } });
});

// @desc    Refund / void a completed order (reverses its recorded revenue)
// @route   PATCH /api/orders/:id/refund
const refundOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);

  if (order.status !== 'COMPLETED' || !order.isBilled) {
    res.status(400);
    throw new Error('Only completed, billed orders can be refunded');
  }

  // Atomically CLAIM the refund so two concurrent refund requests can't both run the
  // reversals below — the gift-card re-credit and coupon-return are read-modify-write
  // and would otherwise double-credit the card / double-return the coupon use. Only
  // the request that flips isRefunded false->true proceeds; the loser is told it is
  // already refunded. (Mirrors the isBilled claim in finalizeOrder.)
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, status: 'COMPLETED', isBilled: true, isRefunded: { $ne: true } },
    { $set: { isRefunded: true, refundReason: reason || '', refundedAt: new Date(), paymentStatus: 'unpaid', amountPaid: 0 } },
    { new: true }
  );
  if (!claimed) {
    res.status(400);
    throw new Error('This order is already refunded');
  }
  // Keep the in-memory doc consistent for the emits/logging below.
  order.isRefunded = true;
  order.refundReason = reason || '';
  order.refundedAt = claimed.refundedAt;
  order.paymentStatus = 'unpaid';
  order.amountPaid = 0;

  // Reverse the revenue: drop the order's REVENUE transaction out of the books by
  // marking it rejected (analytics/P&L count only approved revenue). The order
  // record is kept and flagged refunded for audit.
  const Transaction = require('../models/Transaction');
  await Transaction.updateMany(
    { orderId: order._id, type: 'REVENUE' },
    { $set: { status: 'rejected' } }
  );

  // If this order was settled with a gift card, return the redeemed value to the
  // card (re-credit + reversal txn) — otherwise the customer's prepaid money is
  // lost. Idempotent: skips amounts already reversed for this order.
  const GiftCard = require('../models/GiftCard');
  const gcCards = await GiftCard.find({ transactions: { $elemMatch: { orderId: order._id, type: 'redeem' } } });
  for (const gc of gcCards) {
    const oid = order._id.toString();
    const redeemed = gc.transactions
      .filter(t => t.type === 'redeem' && t.orderId && t.orderId.toString() === oid)
      .reduce((a, t) => a + (t.amount || 0), 0);
    const reversed = gc.transactions
      .filter(t => t.type === 'topup' && t.orderId && t.orderId.toString() === oid && /reversal/i.test(t.note || ''))
      .reduce((a, t) => a + (t.amount || 0), 0);
    const toRestore = redeemed - reversed;
    if (toRestore > 0) {
      await GiftCard.updateOne(
        { _id: gc._id },
        { $inc: { balance: toRestore }, $push: { transactions: { type: 'topup', amount: toRestore, orderId: order._id, by: req.user._id, note: 'refund reversal' } } }
      );
    }
  }

  // Return the coupon use consumed by this (now reversed) order, mirroring
  // cancel/reject — otherwise a single-use coupon stays burned after a refund.
  if (order.coupon) {
    const Coupon = require('../models/Coupon');
    await Coupon.updateOne({ _id: order.coupon, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  }

  // isRefunded / refundedAt / paymentStatus / amountPaid were already persisted
  // atomically by the claim above — no second save needed.

  await logActivity(
    req.user,
    'ORDER_REFUND',
    `Refunded Order #${shortOrderId(order._id)}${reason ? `: ${reason}` : ''}`,
    req,
    { orderId: order._id, locationId: order.branch, amount: order.totalAmount }
  );

  const io = getIO();
  io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: order.status });
  // A cash refund pays money back out of the register — refresh the drawer view.
  if (order.paymentType === 'CASH') {
    io.to(`branch_${order.branch}`).emit('cashdrawer:update', { locationId: String(order.branch) });
  }

  await sendNotification({
    title: 'Order Refunded',
    message: `Order #${shortOrderId(order._id)} was refunded by ${req.user.name}${reason ? `: "${reason}"` : ''}.`,
    type: 'order_action',
    priority: 'high',
    performedByUser: req.user,
    locationId: order.branch,
  });

  res.json({ success: true, data: order });
});

// @desc    Generate Bill for COMPLETED order
const generateOrderBill = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('items.menuItem', 'name price');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  ensureOrderAccess(req, res, order);

  if (order.status !== 'COMPLETED') {
    res.status(400);
    throw new Error(`Cannot generate bill for ${order.status} order. Must be COMPLETED.`);
  }

  // Configurable tax/billing for this branch.
  const settings = await getSettings(order.branch);
  const gstRate = Number(settings?.tax?.gstRate) || 0;
  const serviceChargeRate = Number(settings?.billing?.serviceChargeRate) || 0;

  const subtotal = order.totalAmount;
  const discount = order.discountAmount || 0;
  const taxableAmount = Math.max(0, subtotal - discount);

  // Prefer the figures stored at finalize (single source of truth, so the printed
  // bill matches exactly what was charged + paid). Fall back to computing them for
  // orders completed before service-charge/grand-total were persisted.
  let serviceCharge, taxes, finalAmount;
  if (order.grandTotal && order.grandTotal > 0) {
    serviceCharge = order.serviceCharge || 0;
    taxes = order.taxAmount || 0;
    finalAmount = order.grandTotal;
  } else {
    serviceCharge = Number((taxableAmount * serviceChargeRate / 100).toFixed(2));
    taxes = Number(((taxableAmount + serviceCharge) * gstRate / 100).toFixed(2));
    finalAmount = taxableAmount + serviceCharge + taxes;
    if (settings?.billing?.roundBill) finalAmount = Math.round(finalAmount);
  }

  // Assign a sequential, per-branch invoice number EXACTLY ONCE. Claim the right
  // to assign atomically on the order itself (invoiceNumber: null -> sentinel) so
  // two concurrent bills for the same order can't both consume a sequence number
  // (which would burn one and leave a GST-illegal gap). Only the winner reserves a
  // number and appends the BILLED history entry; re-prints reuse the stored value.
  // The claim sentinel is timestamped so a crash between claiming and assigning
  // can self-heal: a sentinel older than the staleness window is re-claimable.
  // Re-claiming matches the EXACT stale sentinel value, so concurrent recoveries
  // still serialize — the first flips it to a new sentinel and the rest become
  // losers that re-read. Without this, a crashed claim left invoiceNumber stuck on
  // 'PENDING' forever ('PENDING' is truthy, so the block below was skipped) and
  // every future receipt printed the literal sentinel as its invoice number.
  const STALE_CLAIM_MS = 30000;
  const currentInvoice = order.invoiceNumber;
  const isPendingSentinel = typeof currentInvoice === 'string' && currentInvoice.startsWith('PENDING');
  const staleClaim = isPendingSentinel
    && (Date.now() - (Number(currentInvoice.split(':')[1]) || 0) > STALE_CLAIM_MS);

  if (!currentInvoice || staleClaim) {
    const claim = await Order.findOneAndUpdate(
      {
        _id: order._id,
        $or: [
          { invoiceNumber: null },
          { invoiceNumber: { $exists: false } },
          ...(staleClaim ? [{ invoiceNumber: currentInvoice }] : []),
        ],
      },
      { $set: { invoiceNumber: `PENDING:${Date.now()}` } },
      { new: true }
    );
    if (claim) {
      // Seed a new branch sequence from the EFFECTIVE (merged global<branch) start,
      // never restarting at 1 and ignoring an org-configured global nextNumber.
      const effectiveStart = Number(settings?.invoice?.nextNumber) || 1;
      const seq = await Settings.findOneAndUpdate(
        { locationId: order.branch },
        [{ $set: { 'invoice.nextNumber': { $add: [{ $max: [{ $ifNull: ['$invoice.nextNumber', effectiveStart] }, effectiveStart] }, 1] } } }],
        { new: true, upsert: true, updatePipeline: true }
      );
      const reserved = (Number(seq?.invoice?.nextNumber) || (effectiveStart + 1)) - 1;
      const prefix = settings?.invoice?.prefix || 'INV';
      order.invoiceNumber = `${prefix}-${String(reserved).padStart(5, '0')}`;
      await Order.updateOne(
        { _id: order._id },
        { $set: { invoiceNumber: order.invoiceNumber }, $push: { statusHistory: { status: 'BILLED', timestamp: new Date(), updatedBy: req.user._id } } }
      );
    } else {
      // Lost the race — another request is assigning. Reuse the persisted number
      // once it's a real one (never a PENDING:<ts> claim sentinel).
      const fresh = await Order.findById(order._id).select('invoiceNumber');
      if (fresh?.invoiceNumber && !String(fresh.invoiceNumber).startsWith('PENDING')) {
        order.invoiceNumber = fresh.invoiceNumber;
      }
    }
  }

  // Receipt branding comes from the CAFE that owns this order's branch (name, logo,
  // GSTIN, address, contact), with the branch shown as the specific outlet. Fetched
  // separately so we never replace `order.branch` (still used as an id above).
  const Location = require('../models/Location');
  const branchDoc = await Location.findById(order.branch)
    .select('name city state country pincode cafe')
    .populate('cafe', 'name logo gstin address contact')
    .lean();
  const cafeBranding = branchDoc?.cafe || null;

  res.json({
    success: true,
    data: {
      orderId: order._id,
      invoiceNumber: order.invoiceNumber,
      // Brand/organization header for the receipt.
      cafe: cafeBranding ? {
        name: cafeBranding.name,
        logo: cafeBranding.logo || '',
        gstin: cafeBranding.gstin || '',
        address: cafeBranding.address || {},
        contact: cafeBranding.contact || {},
      } : null,
      // The specific outlet (branch) the order was placed at.
      branch: branchDoc ? {
        name: branchDoc.name || '',
        city: branchDoc.city || '',
        state: branchDoc.state || '',
        pincode: branchDoc.pincode || '',
      } : null,
      items: order.items.map(i => ({
        name: i.menuItem?.name || i.itemName,
        quantity: i.quantity,
        price: i.price,
        total: i.quantity * i.price
      })),
      summary: {
        subtotal,
        discount,
        serviceCharge,
        serviceChargeRate,
        taxes,
        gstRate,
        // CGST/SGST split for a GST-compliant invoice.
        cgst: Number((taxes / 2).toFixed(2)),
        sgst: Number((taxes / 2).toFixed(2)),
        // Prefer the cafe's GSTIN (brand-level), falling back to branch settings.
        gstin: cafeBranding?.gstin || settings?.tax?.gstin || '',
        finalAmount
      }
    }
  });
});

// @desc    Get Order Analytics (Deep)
const getOrderAnalytics = asyncHandler(async (req, res) => {
  const { branchId, cafeId, startDate, endDate } = req.query;
  const query = {};

  if (startDate && endDate) {
    query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const branch = scopedLocationId(req, branchId);
  if (branch) query.branch = branch;

  // Honour the cafe filter so the metric cards/charts narrow with the order list.
  if (cafeId && mongoose.isValidObjectId(cafeId)) {
    const Location = require('../models/Location');
    const cafeBranches = (await Location.find({ cafe: cafeId }).select('_id').lean())
      .map((b) => b._id.toString());
    let allowed = cafeBranches;
    if (branch && branch.$in) {
      const set = new Set(branch.$in.map((x) => x.toString()));
      allowed = cafeBranches.filter((b) => set.has(b));
    } else if (branch) {
      allowed = cafeBranches.filter((b) => b === branch.toString());
    }
    query.branch = { $in: allowed };
  }

  // Fetch all orders within the authorized scope
  const allOrders = await Order.find(query)
    .populate('assignedChef', 'name deletedAt')
    .populate('table', 'tableNumber')
    .populate('branch', 'name city')
    .lean();

  // Filter orders for specific branch if requested (for main metrics and other charts)
  const filteredOrders = allOrders;

  let totalPrepTime = 0;
  let prepCount = 0;
  const chefStats = {};
  const statusCounts = {};
  const hourlyCounts = Array(24).fill(0);
  const delayedOrders = [];

  const branchStats = {};

  // 1. Calculate Branch Performance (ALWAYS Global context for the timeframe)
  allOrders.forEach(order => {
    const bId = order.branch?._id?.toString() || order.branch?.toString();
    if (bId) {
      if (!branchStats[bId]) {
        branchStats[bId] = {
          name: order.branch?.name || 'Unknown Branch',
          city: order.branch?.city || '',
          totalOrders: 0,
          totalPrepTime: 0,
          prepCount: 0,
          cancelledCount: 0
        };
      }
      branchStats[bId].totalOrders++;
      if (order.status === 'CANCELLED') branchStats[bId].cancelledCount++;

      const acceptedAt = order.statusHistory.find(h => h.status === 'ACCEPTED')?.timestamp;
      const readyAt = order.statusHistory.find(h => h.status === 'READY')?.timestamp;
      if (acceptedAt && readyAt) {
        const duration = (new Date(readyAt) - new Date(acceptedAt)) / 1000 / 60;
        if (!isNaN(duration)) {
          branchStats[bId].totalPrepTime += duration;
          branchStats[bId].prepCount++;
        }
      }
    }
  });

  // 2. Calculate Main Metrics and Charts (Context-sensitive to branchId)
  filteredOrders.forEach(order => {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    const hour = new Date(order.createdAt).getHours();
    hourlyCounts[hour]++;

    const acceptedAt = order.statusHistory.find(h => h.status === 'ACCEPTED')?.timestamp;
    const readyAt = order.statusHistory.find(h => h.status === 'READY')?.timestamp;

    // Per-chef aggregation: count every order assigned to a chef (not just completed preps)
    if (order.assignedChef) {
      const chefId = order.assignedChef._id.toString();
      if (!chefStats[chefId]) {
        chefStats[chefId] = {
          id: chefId,
          name: order.assignedChef.name,
          count: 0,            // orders with a measured prep time
          totalPrepTime: 0,
          totalOrders: 0,      // every order assigned to this chef
          served: 0,
          cancelled: 0,
          fastest: null,
          slowest: null,
        };
      }
      chefStats[chefId].totalOrders++;
      if (order.status === 'SERVED') chefStats[chefId].served++;
      if (order.status === 'CANCELLED' || order.status === 'REJECTED') chefStats[chefId].cancelled++;
    }

    if (acceptedAt && readyAt) {
      const duration = (new Date(readyAt) - new Date(acceptedAt)) / 1000 / 60;
      if (!isNaN(duration)) {
        totalPrepTime += duration;
        prepCount++;

        if (order.assignedChef) {
          const chef = chefStats[order.assignedChef._id.toString()];
          chef.count++;
          chef.totalPrepTime += duration;
          chef.fastest = chef.fastest == null ? duration : Math.min(chef.fastest, duration);
          chef.slowest = chef.slowest == null ? duration : Math.max(chef.slowest, duration);
        }
      }
    }

    const durationFromStart = (new Date() - new Date(order.createdAt)) / 1000 / 60;
    if (order.status !== 'SERVED' && order.status !== 'CANCELLED' && durationFromStart > 20) {
      delayedOrders.push({
        id: order._id,
        table: order.table?.tableNumber,
        duration: Math.round(durationFromStart),
        status: order.status
      });
    }
  });

  const branchPerformance = Object.entries(branchStats).map(([id, stats]) => ({
    id,
    name: stats.name,
    city: stats.city,
    totalOrders: stats.totalOrders,
    avgPrepTime: stats.prepCount > 0 ? (stats.totalPrepTime / stats.prepCount).toFixed(1) : 0,
    cancellationRate: ((stats.cancelledCount / stats.totalOrders) * 100).toFixed(1)
  }));

  const peakHourVal = Math.max(...hourlyCounts);
  const peakHour = hourlyCounts.indexOf(peakHourVal);

  res.json({
    success: true,
    data: {
      metrics: {
        totalOrders: filteredOrders.length,
        avgPrepTime: prepCount > 0 ? (totalPrepTime / prepCount).toFixed(2) : 0,
        cancelledOrders: statusCounts['CANCELLED'] || 0,
        rejectedOrders: statusCounts['REJECTED'] || 0,
        peakHour: `${peakHour}:00 - ${peakHour + 1}:00`
      },
      charts: {
        ordersPerHour: hourlyCounts.map((count, hour) => ({ hour: `${hour}:00`, count })),
        ordersByStatus: Object.keys(statusCounts).map(status => ({ name: status, value: statusCounts[status] })),
        chefPerformance: Object.values(chefStats)
          .filter(c => c.count > 0)
          .map(c => ({
            id: c.id,
            name: c.name,
            avgTime: (c.totalPrepTime / c.count).toFixed(2),
            total: c.totalOrders,
            completed: c.count,
            served: c.served,
            cancelled: c.cancelled,
            fastest: c.fastest != null ? Number(c.fastest.toFixed(1)) : null,
            slowest: c.slowest != null ? Number(c.slowest.toFixed(1)) : null,
          })),
        branchPerformance
      },
      delayedOrders: delayedOrders.sort((a, b) => b.duration - a.duration).slice(0, 10)
    }
  });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('branch', 'name city')
    .populate('table', 'tableNumber')
    .populate('createdBy', 'name deletedAt')
    .populate('assignedChef', 'name deletedAt')
    .populate('items.menuItem', 'name price dietaryType');
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);
  res.json({ success: true, data: order });
});

const getMyChefStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate, category, foodItem, branch, paymentType, coupon } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  let query = { assignedChef: userId };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (branch) {
    enforceLocationAccess(req, res, branch, 'Permission denied to this branch');
    query.branch = branch;
  }
  if (paymentType) query.paymentType = paymentType;
  if (coupon) query.coupon = coupon;

  if (category) {
    const MenuItem = mongoose.model('MenuItem');
    const itemsInCat = await MenuItem.find({ category }).select('_id');
    const menuItemIds = itemsInCat.map(i => i._id);
    query['items.menuItem'] = { $in: menuItemIds };
  }

  if (foodItem) {
    query['items.menuItem'] = foodItem;
  }

  const allOrders = await Order.find(query)
    .populate({ path: 'items.menuItem', populate: { path: 'category', select: 'name' } })
    .lean();

  let totalPrepTime = 0;
  let prepCount = 0;
  let totalSales = 0;
  const itemCounts = {};
  const catCounts = {};

  allOrders.forEach(order => {
    const acceptedAt = order.statusHistory.find(h => h.status === 'ACCEPTED')?.timestamp;
    const readyAt = order.statusHistory.find(h => h.status === 'READY')?.timestamp;
    if (acceptedAt && readyAt) {
      totalPrepTime += (new Date(readyAt) - new Date(acceptedAt)) / 1000 / 60;
      prepCount++;
    }

    // A fully billed order's terminal status is COMPLETED; SERVED is the prior
    // step. Count both so sales aren't under-reported once an order is completed.
    if (order.status === 'SERVED' || order.status === 'COMPLETED') {
      totalSales += order.totalAmount;
    }

    order.items.forEach(it => {
      if (it.menuItem) {
        const itemId = it.menuItem._id.toString();
        const itemName = it.menuItem.name;
        const catName = it.menuItem.category?.name || 'Uncategorized';
        
        itemCounts[itemId] = (itemCounts[itemId] || { name: itemName, count: 0 });
        itemCounts[itemId].count += it.quantity;
        
        catCounts[catName] = (catCounts[catName] || 0) + it.quantity;
      }
    });
  });

  let bestSellingItem = 'None';
  let maxItemCount = 0;
  Object.values(itemCounts).forEach(it => {
    if (it.count > maxItemCount) {
      maxItemCount = it.count;
      bestSellingItem = it.name;
    }
  });

  let bestSellingCategory = 'None';
  let maxCatCount = 0;
  Object.entries(catCounts).forEach(([cat, count]) => {
    if (count > maxCatCount) {
      maxCatCount = count;
      bestSellingCategory = cat;
    }
  });

  const completedCount = allOrders.filter(o => o.status === 'SERVED' || o.status === 'COMPLETED').length;
  const cancelledCount = allOrders.filter(o => o.status === 'CANCELLED').length;
  const unacceptedCount = allOrders.filter(o => o.status === 'PLACED' || o.status === 'REJECTED').length;

  const Attendance = mongoose.model('Attendance');
  let attQuery = { user: userId };
  if (startDate || endDate) {
    attQuery.date = {};
    if (startDate) attQuery.date.$gte = startDate;
    if (endDate) attQuery.date.$lte = endDate;
  }
  const attendances = await Attendance.find(attQuery);
  const presentCount = attendances.filter(a => a.status === 'present').length;
  const halfDayCount = attendances.filter(a => a.status === 'half-day').length;
  const monthlySalary = req.user.monthlySalary || 0;
  const dailyRate = monthlySalary / 30;
  const dailyPayout = (presentCount * dailyRate) + (halfDayCount * dailyRate * 0.5);

  const paginatedOrders = await Order.find(query)
    .populate('table', 'tableNumber')
    .populate('items.menuItem', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const ordersByDateMap = {};
  const ordersByWeekMap = {};
  const ordersByMonthMap = {};

  allOrders.forEach(o => {
    const dateObj = new Date(o.createdAt);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    ordersByDateMap[dateStr] = (ordersByDateMap[dateStr] || 0) + 1;

    // Week trend
    const weekStr = `Week ${Math.ceil(dateObj.getDate() / 7)}`;
    ordersByWeekMap[weekStr] = (ordersByWeekMap[weekStr] || 0) + 1;

    // Month trend
    const monthStr = dateObj.toLocaleDateString('en-US', { month: 'long' });
    ordersByMonthMap[monthStr] = (ordersByMonthMap[monthStr] || 0) + 1;
  });

  const ordersByDate = Object.entries(ordersByDateMap).map(([date, count]) => ({ date, count }));
  const ordersByWeek = Object.entries(ordersByWeekMap).map(([week, count]) => ({ week, count }));
  const ordersByMonth = Object.entries(ordersByMonthMap).map(([month, count]) => ({ month, count }));

  res.json({
    success: true,
    data: {
      totalOrders: allOrders.length,
      highestValue: allOrders.length > 0 ? Math.max(...allOrders.map(o => o.totalAmount)) : 0,
      lowestValue: allOrders.length > 0 ? Math.min(...allOrders.map(o => o.totalAmount)) : 0,
      completedOrders: completedCount,
      cancelledOrders: cancelledCount,
      unacceptedOrders: unacceptedCount,
      avgTicketSize: completedCount > 0 ? (totalSales / completedCount).toFixed(2) : 0,
      totalSales,
      dailyPayout: dailyPayout.toFixed(2),
      bestSellingCategory,
      bestSellingItem,
      avgPrepTime: prepCount > 0 ? (totalPrepTime / prepCount).toFixed(2) : 0,
      successRate: allOrders.length > 0 ? ((completedCount / allOrders.length) * 100).toFixed(2) : 0,
      recentOrders: paginatedOrders,
      ordersByDate: ordersByDate.slice(-10),
      ordersByWeek,
      ordersByMonth,
      pagination: {
        total: allOrders.length,
        page,
        pages: Math.ceil(allOrders.length / limit),
        limit
      }
    }
  });
});

const getMyStaffStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate, category, foodItem, branch, paymentType, coupon } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  let query = {
    $and: [
      {
        $or: [
          { createdBy: userId },
          { servedBy: userId }
        ]
      }
    ]
  };

  if (startDate || endDate) {
    let dateQ = {};
    if (startDate) dateQ.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateQ.$lte = end;
    }
    query.$and.push({ createdAt: dateQ });
  }

  if (branch) {
    enforceLocationAccess(req, res, branch, 'Permission denied to this branch');
    query.$and.push({ branch });
  }
  if (paymentType) query.$and.push({ paymentType });
  if (coupon) query.$and.push({ coupon });

  if (category) {
    const MenuItem = mongoose.model('MenuItem');
    const itemsInCat = await MenuItem.find({ category }).select('_id');
    const menuItemIds = itemsInCat.map(i => i._id);
    query.$and.push({ 'items.menuItem': { $in: menuItemIds } });
  }

  if (foodItem) {
    query.$and.push({ 'items.menuItem': foodItem });
  }

  const allOrders = await Order.find(query)
    .populate({ path: 'items.menuItem', populate: { path: 'category', select: 'name' } })
    .lean();

  const createdCount = allOrders.filter(o => o.createdBy?.toString() === userId.toString()).length;
  const servedCount = allOrders.filter(o => o.servedBy?.toString() === userId.toString()).length;

  let totalSales = 0;
  const itemCounts = {};
  const catCounts = {};

  allOrders.forEach(order => {
    // A fully billed order's terminal status is COMPLETED; SERVED is the prior
    // step. Count both so sales aren't under-reported once an order is completed.
    if (order.status === 'SERVED' || order.status === 'COMPLETED') {
      totalSales += order.totalAmount;
    }

    order.items.forEach(it => {
      if (it.menuItem) {
        const itemId = it.menuItem._id.toString();
        const itemName = it.menuItem.name;
        const catName = it.menuItem.category?.name || 'Uncategorized';
        
        itemCounts[itemId] = (itemCounts[itemId] || { name: itemName, count: 0 });
        itemCounts[itemId].count += it.quantity;
        
        catCounts[catName] = (catCounts[catName] || 0) + it.quantity;
      }
    });
  });

  let bestSellingItem = 'None';
  let maxItemCount = 0;
  Object.values(itemCounts).forEach(it => {
    if (it.count > maxItemCount) {
      maxItemCount = it.count;
      bestSellingItem = it.name;
    }
  });

  let bestSellingCategory = 'None';
  let maxCatCount = 0;
  Object.entries(catCounts).forEach(([cat, count]) => {
    if (count > maxCatCount) {
      maxCatCount = count;
      bestSellingCategory = cat;
    }
  });

  const completedCount = allOrders.filter(o => o.status === 'SERVED' || o.status === 'COMPLETED').length;
  const cancelledCount = allOrders.filter(o => o.status === 'CANCELLED').length;
  const unacceptedCount = allOrders.filter(o => o.status === 'PLACED' || o.status === 'REJECTED').length;

  const Attendance = mongoose.model('Attendance');
  let attQuery = { user: userId };
  if (startDate || endDate) {
    attQuery.date = {};
    if (startDate) attQuery.date.$gte = startDate;
    if (endDate) attQuery.date.$lte = endDate;
  }
  const attendances = await Attendance.find(attQuery);
  const presentCount = attendances.filter(a => a.status === 'present').length;
  const halfDayCount = attendances.filter(a => a.status === 'half-day').length;
  const monthlySalary = req.user.monthlySalary || 0;
  const dailyRate = monthlySalary / 30;
  const dailyPayout = (presentCount * dailyRate) + (halfDayCount * dailyRate * 0.5);

  const paginatedOrders = await Order.find(query)
    .populate('table', 'tableNumber')
    .populate('items.menuItem', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const ordersByDateMap = {};
  const ordersByWeekMap = {};
  const ordersByMonthMap = {};

  allOrders.forEach(o => {
    const dateObj = new Date(o.createdAt);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    ordersByDateMap[dateStr] = (ordersByDateMap[dateStr] || 0) + 1;

    // Week trend
    const weekStr = `Week ${Math.ceil(dateObj.getDate() / 7)}`;
    ordersByWeekMap[weekStr] = (ordersByWeekMap[weekStr] || 0) + 1;

    // Month trend
    const monthStr = dateObj.toLocaleDateString('en-US', { month: 'long' });
    ordersByMonthMap[monthStr] = (ordersByMonthMap[monthStr] || 0) + 1;
  });

  const ordersByDate = Object.entries(ordersByDateMap).map(([date, count]) => ({ date, count }));
  const ordersByWeek = Object.entries(ordersByWeekMap).map(([week, count]) => ({ week, count }));
  const ordersByMonth = Object.entries(ordersByMonthMap).map(([month, count]) => ({ month, count }));

  res.json({
    success: true,
    data: {
      totalOrders: allOrders.length,
      highestValue: allOrders.length > 0 ? Math.max(...allOrders.map(o => o.totalAmount)) : 0,
      lowestValue: allOrders.length > 0 ? Math.min(...allOrders.map(o => o.totalAmount)) : 0,
      completedOrders: completedCount,
      cancelledOrders: cancelledCount,
      unacceptedOrders: unacceptedCount,
      avgTicketSize: completedCount > 0 ? (totalSales / completedCount).toFixed(2) : 0,
      totalSales,
      dailyPayout: dailyPayout.toFixed(2),
      bestSellingCategory,
      bestSellingItem,
      createdCount,
      servedCount,
      successRate: allOrders.length > 0 ? ((completedCount / allOrders.length) * 100).toFixed(2) : 0,
      recentOrders: paginatedOrders,
      ordersByDate: ordersByDate.slice(-10),
      ordersByWeek,
      ordersByMonth,
      pagination: {
        total: allOrders.length,
        page,
        pages: Math.ceil(allOrders.length / limit),
        limit
      }
    }
  });
});

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updateOrderItems,
  rejectOrder,
  cancelOrder,
  addChefNote,
  acceptOrder,
  startPreparing,
  markReady,
  markServed: asyncHandler(async (req, res) => {
    req.body.status = 'SERVED';
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }
    ensureOrderAccess(req, res, order);

    // servedBy is now persisted inside updateStatus('SERVED'), avoiding a
    // separate save + a second status write.
    const updatedOrder = await OrderService.updateStatus(orderId, 'SERVED', req.user._id, req.user.role);
    res.json({ success: true, data: updatedOrder });
  }),
  completeOrder,
  forceCompleteOrder,
  generateOrderBill,
  recordPayment,
  approvePayment,
  declineOrder,
  refundOrder,
  getGstReport,
  updateItemStatus,
  moveOrderTable,
  splitOrder,
  reorderOrder,
  getOrderAnalytics,
  getMyChefStats,
  getMyStaffStats,
  deleteOrder
};
