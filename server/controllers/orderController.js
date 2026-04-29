const Order = require('../models/Order');
const Table = require('../models/Table');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const BranchStock = require('../models/BranchStock');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');

// @desc    Create a new order
const createOrder = asyncHandler(async (req, res) => {
  if (req.user.role == 'chef') {
    res.status(403);
    throw new Error('Only staff can create orders');
  }

  const { branch, table: tableId, items, totalAmount, customerPhone, customerName } = req.body;

  // Anti-Spam Check: Prevent duplicate orders within 10 seconds
  const recentOrder = await Order.findOne({
    table: tableId,
    branch,
    createdAt: { $gte: new Date(Date.now() - 10000) }
  });

  if (recentOrder) {
    res.status(429);
    throw new Error('Please wait 10 seconds before placing another order for this table.');
  }

  // Stock Check and Deduction
  for (const item of items) {
    const branchStock = await BranchStock.findOne({ menuItem: item.menuItem, branch });
    if (branchStock) {
      if (branchStock.stock < item.quantity) {
        res.status(400);
        throw new Error(`Insufficient stock for item. Only ${branchStock.stock} remaining.`);
      }
      if (!branchStock.isAvailable) {
        res.status(400);
        throw new Error(`Item is currently unavailable at this branch.`);
      }
    }
  }

  // Atomically decrease stock
  for (const item of items) {
    await BranchStock.findOneAndUpdate(
      { menuItem: item.menuItem, branch },
      {
        $inc: { stock: -item.quantity },
      },
      { new: true }
    ).then(async (updatedStock) => {
      if (updatedStock && updatedStock.stock <= 0) {
        updatedStock.isAvailable = false;
        await updatedStock.save();
      }
    });
  }

  const order = await Order.create({
    branch,
    table: tableId,
    customerPhone,
    customerName,
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
  if (tableId) filter.table = tableId;
  if (isBilled !== undefined) filter.isBilled = isBilled === 'true';
  if (createdBy) filter.createdBy = createdBy;

  if (startDate && endDate) {
    filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  // STRICT RBAC
  if (req.user.role === 'super_admin') {
    if (branchId && branchId !== 'all') filter.branch = branchId;
  } else if (req.user.role === 'admin') {
    if (branchId && branchId !== 'all') {
      const isAccessible = req.user.accessibleLocations?.some(loc => loc.toString() === branchId);
      if (!isAccessible) return res.status(403).json({ message: 'Access denied to this location' });
      filter.branch = branchId;
    } else {
      filter.branch = { $in: req.user.accessibleLocations || [] };
    }
  } else {
    // Branch Admin, Chef, Staff
    filter.branch = req.user.assignedLocation;
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
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
    .limit(limit);

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

    // Customer CRM Lifecycle Hooks
    if (order.customerPhone) {
      const Customer = require('../models/Customer');
      const Coupon = require('../models/Coupon');
      
      let customer = await Customer.findOne({ phone: order.customerPhone });
      if (!customer) {
        customer = new Customer({
          phone: order.customerPhone,
          name: order.customerName || 'Valued Customer',
          branch: order.branch
        });
      }

      customer.visits += 1;
      customer.totalSpend += order.totalAmount;
      customer.lastVisit = new Date();
      
      const pointsEarned = Math.floor(order.totalAmount / 100);
      customer.loyaltyPoints += pointsEarned;

      order.items.forEach(item => {
        const itemId = item.menuItem?._id?.toString() || item.menuItem?.toString();
        if (itemId) {
          const currentCount = customer.favoriteItems.get(itemId) || 0;
          customer.favoriteItems.set(itemId, currentCount + item.quantity);
        }
      });

      if (customer.loyaltyPoints >= 100) {
        customer.loyaltyPoints -= 100;
        const couponCode = `REWARD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);

        await Coupon.create({
          code: couponCode,
          discountType: 'fixed',
          discountValue: 100,
          minOrderAmount: 300,
          expiryDate: expiry,
          usageLimit: 1,
          createdBy: req.user._id,
          isActive: true
        });
        
        io.to(`branch_${branchId}`).emit('customer:reward_unlocked', { phone: customer.phone, couponCode });
      }

      await customer.save();
    }

    // Inventory Auto-Deduction Logic
    const Recipe = require('../models/Recipe');
    const BranchInventory = require('../models/BranchInventory');
    const BranchStock = require('../models/BranchStock');

    for (const item of order.items) {
      const recipe = await Recipe.findOne({ menuItemId: item.menuItem?._id || item.menuItem });
      if (recipe) {
        for (const ing of recipe.ingredients) {
          if (ing.ingredient) {
            const deduction = Number(ing.quantity || 0) * Number(item.quantity || 1);
            const updatedInv = await BranchInventory.findOneAndUpdate(
              { branch: order.branch, ingredient: ing.ingredient },
              { $inc: { stock: -deduction } },
              { new: true }
            ).populate('ingredient');

            // Trigger Socket alert if low stock
            if (updatedInv && updatedInv.stock <= updatedInv.minThreshold) {
              const io = require('../config/socket').getIO();
              io.to(`branch_${order.branch}_admin`).emit('inventory:low_stock', {
                ingredient: updatedInv.ingredient.name,
                stock: updatedInv.stock,
                unit: updatedInv.ingredient.unit
              });
            }

            // If stock hits 0, disable MenuItem availability
            if (updatedInv && updatedInv.stock <= 0) {
              await BranchStock.findOneAndUpdate(
                { branch: order.branch, menuItem: item.menuItem?._id || item.menuItem },
                { isAvailable: false }
              );
            }
          }
        }
      }
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

  // Stock Adjustment Logic
  const oldItems = order.items;
  const newItems = items;

  // Calculate delta for each item
  const itemMap = {}; // { menuItemId: delta }

  // Decrease for old items (we will restore them conceptually then subtract new ones)
  oldItems.forEach(item => {
    const id = item.menuItem.toString();
    itemMap[id] = (itemMap[id] || 0) + item.quantity;
  });

  // Subtract new items
  newItems.forEach(item => {
    const id = item.menuItem.toString();
    itemMap[id] = (itemMap[id] || 0) - item.quantity;
  });

  // itemMap now contains positive numbers for stock restoration, negative for depletion
  for (const [menuItemId, delta] of Object.entries(itemMap)) {
    if (delta < 0) {
      // Depletion: check stock
      const needed = Math.abs(delta);
      const branchStock = await BranchStock.findOne({ menuItem: menuItemId, branch: order.branch });
      if (branchStock && branchStock.stock < needed) {
        res.status(400);
        throw new Error(`Insufficient stock for one or more items. Adjustment failed.`);
      }
    }
  }

  // Atomically update stock
  for (const [menuItemId, delta] of Object.entries(itemMap)) {
    if (delta !== 0) {
      const updatedStock = await BranchStock.findOneAndUpdate(
        { menuItem: menuItemId, branch: order.branch },
        {
          $inc: { stock: delta },
        },
        { new: true, upsert: true }
      );

      if (updatedStock) {
        updatedStock.isAvailable = updatedStock.stock > 0;
        await updatedStock.save();
      }
    }
  }

  order.items = items;
  order.totalAmount = totalAmount;
  await order.save();

  const io = getIO();
  io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: order.status });

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

  // Restore Stock
  for (const item of order.items) {
    await BranchStock.findOneAndUpdate(
      { menuItem: item.menuItem, branch: order.branch },
      {
        $inc: { stock: item.quantity },
        isAvailable: true
      }
    );
  }

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

  const io = getIO();
  io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: 'REJECTED' });

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

  // Restore Stock
  for (const item of order.items) {
    await BranchStock.findOneAndUpdate(
      { menuItem: item.menuItem, branch: order.branch },
      {
        $inc: { stock: item.quantity },
        isAvailable: true
      }
    );
  }
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
  
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  order.chefNote = req.body.chefNote;
  await order.save();

  // Duplicate Prevention Check (60 seconds)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const duplicate = await Notification.findOne({
    title: 'New Chef Note',
    message: `Chef left a note on Order #${order._id.toString().slice(-6)}: "${req.body.chefNote}"`,
    sender: req.user._id,
    createdAt: { $gte: oneMinuteAgo }
  });

  if (!duplicate) {
    const recipients = [];
    
    if (order.createdBy) {
      recipients.push({ user: order.createdBy, isRead: false });
    }
    
    const branchAdmins = await User.find({ role: 'branch_admin', assignedLocation: order.branch });
    branchAdmins.forEach(u => recipients.push({ user: u._id, isRead: false }));
    
    const admins = await User.find({ role: 'admin', accessibleLocations: order.branch });
    admins.forEach(u => recipients.push({ user: u._id, isRead: false }));
    
    const supers = await User.find({ role: 'super_admin' });
    supers.forEach(u => recipients.push({ user: u._id, isRead: false }));

    const uniqueRecipients = [];
    const seen = new Set();
    recipients.forEach(r => {
      const idStr = r.user.toString();
      if (!seen.has(idStr) && idStr !== req.user._id.toString()) {
        seen.add(idStr);
        uniqueRecipients.push(r);
      }
    });

    if (uniqueRecipients.length > 0) {
      const notification = await Notification.create({
        title: 'New Chef Note',
        message: `Chef left a note on Order #${order._id.toString().slice(-6)}: "${req.body.chefNote}"`,
        type: 'message',
        priority: 'medium',
        sender: req.user._id,
        recipients: uniqueRecipients
      });

      const io = getIO();
      uniqueRecipients.forEach(r => {
        io.to(r.user.toString()).emit('new_notification', {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          priority: notification.priority,
          createdAt: notification.createdAt,
          sender: {
            name: req.user.name,
            role: req.user.role,
            profileImageUrl: req.user.profileImageUrl
          }
        });
      });
    }
  }

  const io = getIO();
  io.to(`branch_${order.branch}`).emit('order:note', { orderId: order._id, chefNote: req.body.chefNote });
  io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: order.status });

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
  const { startDate, endDate, category, foodItem, branch, paymentType, coupon } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
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

  if (branch) query.branch = branch;
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
    .populate({ path: 'items.menuItem', populate: { path: 'category', select: 'name' } });

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
  const limit = parseInt(req.query.limit, 10) || 20;
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

  if (branch) query.$and.push({ branch });
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
    .populate({ path: 'items.menuItem', populate: { path: 'category', select: 'name' } });

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
