const Transaction = require('../models/Transaction');
const Table = require('../models/Table');
const { deductIngredientsFromRecipe } = require('../controllers/inventoryController');

/**
 * Finalizes an order, records revenue, and deducts ingredients.
 * @param {Object} order - The populated order object.
 * @param {Object} user - The user performing the action.
 * @returns {Promise<Object>} - The finalized order.
 */
const finalizeOrder = async (order, user) => {
  if (order.isBilled) {
    throw new Error('This order has already been finalized and billed.');
  }

  order.status = 'COMPLETED';
  order.completedAt = new Date();
  order.isBilled = true;
  order.statusHistory.push({
    status: 'COMPLETED',
    timestamp: new Date(),
    updatedBy: user._id
  });

  // Calculate total profit
  const totalProfit = order.items.reduce((acc, item) => {
    const price = Number(item.price || 0);
    const costPrice = Number(item.costPrice || 0);
    return acc + ((price - costPrice) * item.quantity);
  }, 0);

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
    totalAmount: order.totalAmount,
    totalProfit: totalProfit,
    date: new Date(),
    status: 'approved',
    orders: order.items.map(i => ({
      menuItemId: i.menuItem?._id || i.menuItem,
      itemName: i.itemName || 'Item',
      quantity: i.quantity,
      price: i.price,
      costPrice: i.costPrice || 0
    }))
  });

  // Deduct ingredients
  await deductIngredientsFromRecipe(order, order.branch);

  // Decrement active orders count on table
  await Table.findByIdAndUpdate(order.table, {
    $inc: { activeOrdersCount: -1 }
  });

  await order.save();
  return order;
};

module.exports = { finalizeOrder };
