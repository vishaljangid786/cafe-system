const mongoose = require('mongoose');
const Order = require('../models/Order');
const Table = require('../models/Table');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const BranchStock = require('../models/BranchStock');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const { enforceLocationAccess, clampLimit, scopedLocationId, endOfDay, escapeRegex } = require('../utils/accessControl');
const { logActivity } = require('../utils/auditLogger');
const sendNotification = require('../utils/sendNotification');
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

  const { branch: requestedBranch, table: tableId, items, customerPhone, customerName, discountAmount, couponId, paymentType } = req.body;
  const branch = ['staff', 'chef'].includes(req.user.role)
    ? req.user.assignedLocation
    : (requestedBranch || (req.user.role === 'branch_admin' ? req.user.assignedLocation : null));

  if (!branch) {
    res.status(400);
    throw new Error('Branch is required');
  }

  enforceLocationAccess(req, res, branch, 'You do not have permission to create orders for this branch');

  const table = await Table.findOne({ _id: tableId, locationId: branch });
  if (!table) {
    res.status(403);
    throw new Error('Selected table does not belong to this branch');
  }

  const order = await OrderService.createOrder({
    branch,
    tableId,
    items,
    customerPhone,
    customerName,
    discountAmount: Number(discountAmount) || 0,
    couponId: couponId || null,
    paymentType: paymentType || 'CASH',
    userId: req.user._id
  });

  res.status(201).json({ success: true, data: order });
});

// @desc    Get orders
const getOrders = asyncHandler(async (req, res) => {
  const { status, branchId, tableId, isBilled, createdBy, startDate, endDate, search } = req.query;
  const filter = {};

  const VALID_ORDER_STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
  if (status && VALID_ORDER_STATUSES.includes(status)) filter.status = status;
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

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  const total = await Order.countDocuments(filter);

  const orders = await Order.find(filter)
    .populate('branch', 'name city')
    .populate('table', 'tableNumber')
    .populate('createdBy', 'name')
    .populate('assignedChef', 'name')
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
const deleteOrder = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  ensureOrderAccess(req, res, order);
  
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    res.status(403);
    throw new Error('No permission to delete orders');
  }

  await OrderService.deleteOrder(orderId, req.user.role);
  
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

  const subtotal = order.totalAmount;
  const discount = order.discountAmount || 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxes = Number((taxableAmount * 0.05).toFixed(2)); // 5% GST
  const finalAmount = taxableAmount + taxes;

  // Idempotency guard: only record BILLED history the first time. Repeat calls
  // (re-print / double-click) re-compute and return the bill but must not append
  // duplicate BILLED history entries.
  const alreadyBilled = order.statusHistory.some(h => h.status === 'BILLED');
  if (!alreadyBilled) {
    order.statusHistory.push({
      status: 'BILLED',
      timestamp: new Date(),
      updatedBy: req.user._id
    });
    await order.save();
  }

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

  const branch = scopedLocationId(req, branchId);
  if (branch) query.branch = branch;

  // Fetch all orders within the authorized scope
  const allOrders = await Order.find(query)
    .populate('assignedChef', 'name')
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

    if (order.status === 'SERVED') {
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

  const completedCount = allOrders.filter(o => o.status === 'SERVED').length;
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

  const createdCount = allOrders.filter(o => o.createdBy.toString() === userId.toString()).length;
  const servedCount = allOrders.filter(o => o.servedBy?.toString() === userId.toString()).length;

  let totalSales = 0;
  const itemCounts = {};
  const catCounts = {};

  allOrders.forEach(order => {
    if (order.status === 'SERVED') {
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

  const completedCount = allOrders.filter(o => o.status === 'SERVED').length;
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
  getOrderAnalytics,
  getMyChefStats,
  getMyStaffStats,
  deleteOrder
};
