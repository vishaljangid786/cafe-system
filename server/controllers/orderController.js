const Order = require('../models/Order');
const Table = require('../models/Table');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');

// @desc    Create a new order
const createOrder = asyncHandler(async (req, res) => {
  if (req.user.role == 'chef') {
    res.status(403);
    throw new Error('Only staff can create orders');
  }

  const { branch, table: tableId, items, totalAmount } = req.body;

  const order = await Order.create({
    branch,
    table: tableId,
    items,
    totalAmount,
    createdBy: req.user._id,
    status: 'PLACED',
    statusHistory: [{ 
      status: 'PLACED', 
      timestamp: new Date(),
      updatedBy: req.user._id
    }]
  });

  // Increment active orders count and update table status
  await Table.findByIdAndUpdate(tableId, { 
    status: 'ongoing',
    $inc: { activeOrdersCount: 1 }
  });

  const io = getIO();
  io.to(`branch_${branch}_chef`).emit('order:new', { orderId: order._id });
  io.to('role_admin').to('role_super_admin').emit('order:new', { orderId: order._id, branchId: branch });

  res.status(201).json({ success: true, data: order });
});

// @desc    Get orders
const getOrders = asyncHandler(async (req, res) => {
  const { status, branchId, tableId, isBilled, createdBy, startDate, endDate } = req.query;
  const filter = {};

  if (status) filter.status = status;
  if (branchId && branchId !== 'all') filter.branch = branchId;
  if (tableId) filter.table = tableId;
  if (isBilled !== undefined) filter.isBilled = isBilled === 'true';
  if (createdBy) filter.createdBy = createdBy;

  if (startDate && endDate) {
    filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  if (['branch_admin', 'chef', 'staff'].includes(req.user.role)) {
    filter.branch = req.user.assignedLocation;
  }

  const orders = await Order.find(filter)
    .populate('branch', 'name city')
    .populate('table', 'tableNumber')
    .populate('createdBy', 'name')
    .populate('assignedChef', 'name')
    .populate('items.menuItem', 'name price dietaryType')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: orders.length, data: orders });
});

// @desc    Update order status
const updateOrderStatus = asyncHandler(async (req, res) => {
  req.body = req.body || {};
  const { status } = req.body;
  const order = req.omsOrder || await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Auto-assign chef if transitioning to ACCEPTED
  if (status === 'ACCEPTED' && req.user.role === 'chef') {
    order.assignedChef = req.user._id;
  }

  order.status = status;
  order.statusHistory.push({ 
    status, 
    timestamp: new Date(),
    updatedBy: req.user._id 
  });

  if (status === 'COMPLETED') {
    order.completedAt = new Date();
  }

  await order.save();

  const io = getIO();
  const branchId = order.branch.toString();
  
  // Real-time notifications
  io.to(`branch_${branchId}`).emit('order:update', { orderId: order._id, status: order.status });
  
  if (status === 'READY') {
    io.to(`branch_${branchId}_staff`).emit('order:ready', { orderId: order._id, message: 'Order Ready!' });
  }

  if (status === 'COMPLETED') {
    // IDEMPOTENCY PROTECTION: Prevent duplicate revenue entries
    if (order.isBilled) {
      res.status(400);
      throw new Error('This order has already been finalized and billed.');
    }

    order.completedAt = new Date();
    order.isBilled = true;

    // Create REVENUE Transaction
    const Transaction = require('../models/Transaction');
    
    // Calculate total profit for this specific order
    const totalProfit = order.items.reduce((acc, item) => {
      // price and costPrice are already numbers from the previous turns' fixes
      const price = Number(item.price || 0);
      const costPrice = Number(item.menuItem?.costPrice || item.costPrice || 0);
      return acc + ((price - costPrice) * item.quantity);
    }, 0);

    await Transaction.create({
      locationId: order.branch,
      type: 'REVENUE',
      source: 'ORDER',
      orderId: order._id,
      createdBy: req.user._id,
      totalAmount: order.totalAmount,
      totalProfit: totalProfit,
      date: new Date(),
      status: 'approved',
      orders: order.items.map(i => ({
        menuItemId: i.menuItem?._id || i.menuItem,
        itemName: i.itemName || 'Item',
        quantity: i.quantity,
        price: i.price,
        costPrice: i.menuItem?.costPrice || i.costPrice || 0
      }))
    });

    // Decrement active orders count
    await Table.findByIdAndUpdate(order.table, { 
      $inc: { activeOrdersCount: -1 }
    });

    // Check if table can be cleared
    const table = await Table.findById(order.table);
    if (table && table.activeOrdersCount <= 0) {
      await Table.findByIdAndUpdate(order.table, { status: 'available' });
    }
  }

  res.json({ success: true, data: order });
});

// @desc    Modify order items
const updateOrderItems = asyncHandler(async (req, res) => {
  const { items, totalAmount } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const lockedStatuses = ['PREPARING', 'READY', 'SERVED', 'CANCELLED', 'REJECTED'];
  if (lockedStatuses.includes(order.status)) {
    res.status(400);
    throw new Error(`Cannot modify order in ${order.status} status`);
  }

  order.items = items;
  order.totalAmount = totalAmount;
  await order.save();

  res.json({ success: true, data: order });
});

// @desc    Reject order with reason
const rejectOrder = asyncHandler(async (req, res) => {
  req.body = req.body || {};
  const { rejectReason } = req.body;
  if (req.user.role !== 'chef') {
    res.status(403);
    throw new Error('Only chefs can reject orders');
  }
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  order.status = 'REJECTED';
  order.rejectReason = rejectReason;
  order.assignedChef = req.user._id;
  order.statusHistory.push({ 
    status: 'REJECTED', 
    timestamp: new Date(),
    updatedBy: req.user._id 
  });
  
  // Decrement active orders count on rejection
  await Table.findByIdAndUpdate(order.table, { 
    $inc: { activeOrdersCount: -1 }
  });
  
  await order.save();
  res.json({ success: true, data: order });
});

// @desc    Cancel order
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  if (!['admin', 'super_admin', 'branch_admin'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Unauthorized to cancel orders');
  }
  order.status = 'CANCELLED';
  order.statusHistory.push({ 
    status: 'CANCELLED', 
    timestamp: new Date(),
    updatedBy: req.user._id
  });
  
  // Decrement active orders count on cancellation
  await Table.findByIdAndUpdate(order.table, { 
    $inc: { activeOrdersCount: -1 }
  });
  
  await order.save();
  const io = getIO();
  io.to(`branch_${order.branch}`).emit('order:cancel', { orderId: order._id });
  res.json({ success: true, data: order });
});

// @desc    Add chef note
const addChefNote = asyncHandler(async (req, res) => {
  if (req.user.role !== 'chef') {
    res.status(403);
    throw new Error('Only chefs can add notes');
  }
  req.body = req.body || {};
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { chefNote: req.body.chefNote },
    { new: true }
  );
  
  const io = getIO();
  io.to(`branch_${order.branch}`).emit('order:note', { orderId: order._id, chefNote: req.body.chefNote });
  
  res.json({ success: true, data: order });
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

// @desc    Generate Bill for COMPLETED order
const generateOrderBill = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('items.menuItem', 'name price');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.status !== 'COMPLETED') {
    res.status(400);
    throw new Error(`Cannot generate bill for ${order.status} order. Must be COMPLETED.`);
  }

  const subtotal = order.totalAmount;
  const taxes = Number((subtotal * 0.05).toFixed(2)); // 5% GST
  const discount = 0; // Future: handle applied coupons if needed
  const finalAmount = subtotal + taxes - discount;

  // Record billing in history
  order.statusHistory.push({
    status: 'BILLED',
    timestamp: new Date(),
    updatedBy: req.user._id
  });
  await order.save();

  res.json({
    success: true,
    data: {
      orderId: order._id,
      items: order.items.map(i => ({
        name: i.menuItem?.name || i.itemName,
        quantity: i.quantity,
        price: i.price,
        total: i.quantity * i.price
      })),
      summary: {
        subtotal,
        taxes,
        discount,
        finalAmount
      }
    }
  });
});

// @desc    Get Order Analytics (Deep)
const getOrderAnalytics = asyncHandler(async (req, res) => {
  const { branchId, startDate, endDate } = req.query;
  const query = {};

  if (startDate && endDate) {
    query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  // Fetch all orders for the timeframe to build the global context
  const allOrders = await Order.find(query)
    .populate('assignedChef', 'name')
    .populate('table', 'tableNumber')
    .populate('branch', 'name city');

  // Filter orders for specific branch if requested (for main metrics and other charts)
  const filteredOrders = (branchId && branchId !== 'all') 
    ? allOrders.filter(o => o.branch?._id?.toString() === branchId || o.branch?.toString() === branchId)
    : allOrders;

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

    if (acceptedAt && readyAt) {
      const duration = (new Date(readyAt) - new Date(acceptedAt)) / 1000 / 60;
      if (!isNaN(duration)) {
        totalPrepTime += duration;
        prepCount++;
        
        if (order.assignedChef) {
          const chefId = order.assignedChef._id.toString();
          if (!chefStats[chefId]) {
            chefStats[chefId] = { name: order.assignedChef.name, count: 0, totalPrepTime: 0 };
          }
          chefStats[chefId].count++;
          chefStats[chefId].totalPrepTime += duration;
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
        chefPerformance: Object.values(chefStats).map(c => ({
          name: c.name,
          avgTime: (c.totalPrepTime / c.count).toFixed(2),
          total: c.count
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
    .populate('createdBy', 'name')
    .populate('assignedChef', 'name')
    .populate('items.menuItem', 'name price dietaryType');
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  res.json({ success: true, data: order });
});

const getMyChefStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate } = req.query;

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

  const orders = await Order.find(query)
    .populate('table', 'tableNumber')
    .populate('items.menuItem', 'name');
  
  let totalPrepTime = 0;
  let prepCount = 0;
  
  // Count rejections within the same timeframe
  let rejectionsQuery = { assignedChef: userId, status: 'REJECTED' };
  if (query.createdAt) rejectionsQuery.createdAt = query.createdAt;
  const rejections = await Order.countDocuments(rejectionsQuery);

  orders.forEach(order => {
    const acceptedAt = order.statusHistory.find(h => h.status === 'ACCEPTED')?.timestamp;
    const readyAt = order.statusHistory.find(h => h.status === 'READY')?.timestamp;
    if (acceptedAt && readyAt) {
      totalPrepTime += (new Date(readyAt) - new Date(acceptedAt)) / 1000 / 60;
      prepCount++;
    }
  });

  res.json({
    success: true,
    data: {
      totalOrders: orders.length,
      avgPrepTime: prepCount > 0 ? (totalPrepTime / prepCount).toFixed(2) : 0,
      rejectionsCount: rejections,
      recentOrders: orders.sort((a, b) => b.createdAt - a.createdAt).slice(0, 10)
    }
  });
});

const getMyStaffStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate } = req.query;

  let query = { 
    $or: [
      { createdBy: userId },
      { servedBy: userId }
    ]
  };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const orders = await Order.find(query)
    .populate('table', 'tableNumber')
    .populate('items.menuItem', 'name')
    .sort({ createdAt: -1 });
  
  const createdCount = orders.filter(o => o.createdBy.toString() === userId.toString()).length;
  const servedCount = orders.filter(o => o.servedBy?.toString() === userId.toString()).length;

  res.json({
    success: true,
    data: {
      totalOrders: orders.length,
      createdCount,
      servedCount,
      recentOrders: orders.slice(0, 15)
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
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }
    order.servedBy = req.user._id;
    await order.save();
    req.omsOrder = order; // Pass to updateOrderStatus if needed, but we can just call it
    await updateOrderStatus(req, res);
  }),
  completeOrder,
  forceCompleteOrder,
  generateOrderBill,
  getOrderAnalytics,
  getMyChefStats,
  getMyStaffStats
};
