const Transaction = require('../models/Transaction');
const Table = require('../models/Table');
const Order = require('../models/Order');
const { deductIngredientsFromRecipe } = require('../services/inventoryService');

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
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, isBilled: { $ne: true } },
    {
      $set: { isBilled: true, status: 'COMPLETED', completedAt: now },
      $push: { statusHistory: { status: 'COMPLETED', timestamp: now, updatedBy: user._id } },
    },
    { new: true }
  );
  if (!claimed) {
    throw new Error('This order has already been finalized and billed.');
  }

  order.status = 'COMPLETED';
  order.completedAt = now;
  order.isBilled = true;

  // Calculate gross profit from items
  const grossProfit = order.items.reduce((acc, item) => {
    const price = Number(item.price || 0);
    const costPrice = Number(item.costPrice || 0);
    const qty = Number(item.quantity || 0);
    return acc + ((price - costPrice) * qty);
  }, 0);

  // Net Profit = Gross Profit - Discount
  const totalProfit = grossProfit - (Number(order.discountAmount) || 0);

  // Create Transaction
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
    totalAmount: Number(order.totalAmount || 0),
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

  // Deduct ingredients
  await deductIngredientsFromRecipe(order, order.branch);

  // Decrement active orders count on table
  const updatedTable = await Table.findByIdAndUpdate(
    order.table,
    { $inc: { activeOrdersCount: -1 } },
    { new: true, runValidators: false }
  );

  // Auto-clear table if no more active orders
  if (updatedTable && updatedTable.activeOrdersCount <= 0) {
    updatedTable.status = 'available';
    updatedTable.activeOrdersCount = 0; // Guard against negative numbers
    await updatedTable.save();
  }

  // status/isBilled were persisted atomically above — no second save needed.
  return order;
};

module.exports = { finalizeOrder };
