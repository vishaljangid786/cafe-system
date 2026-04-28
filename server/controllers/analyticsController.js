const mongoose = require('mongoose');
const Table = require('../models/Table');
const Expense = require('../models/Expense');
const Location = require('../models/Location');
const Attendance = require('../models/Attendance');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Helper to get match criteria based on time filters
const getDateMatchCriteria = (startDate, endDate, period, field = 'createdAt') => {
  const match = {};
  if (period) {
    let days;
    if (period === 'week') days = 7;
    else if (period === 'month') days = 30;
    else if (period === 'year') days = 365;
    else days = parseInt(period);

    if (!isNaN(days)) {
      match[field] = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
  } else if (startDate || endDate) {
    match[field] = {};
    if (startDate) match[field].$gte = new Date(startDate);
    if (endDate) match[field].$lte = new Date(endDate);
  }
  return match;
};

// @desc    Get analytics for a specific location
// @route   GET /api/analytics/location
// @access  Private
const getLocationAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, locationId } = req.query;
  const targetLocation = req.user.role === 'branch_admin' ? req.user.assignedLocation : locationId;

  if (!targetLocation) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  const dateMatch = getDateMatchCriteria(startDate, endDate);

  // Revenue Aggregation
  const revenueAgg = await Table.aggregate([
    { $match: { locationId: new mongoose.Types.ObjectId(targetLocation), status: 'completed', ...dateMatch } },
    { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
  ]);

  // Expense Aggregation
  const expenseAgg = await Expense.aggregate([
    { $match: { locationId: new mongoose.Types.ObjectId(targetLocation), ...(startDate || endDate ? { date: dateMatch.createdAt } : {}) } },
    { $group: { _id: null, totalExpense: { $sum: '$amount' } } }
  ]);

  const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
  const totalExpense = expenseAgg[0]?.totalExpense || 0;
  const profit = totalRevenue - totalExpense;

  res.json({
    success: true,
    data: {
      locationId: targetLocation,
      totalRevenue,
      totalExpense,
      profit,
    }
  });
});

// @desc    Get global analytics
// @route   GET /api/analytics/all
const getAllAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateMatch = getDateMatchCriteria(startDate, endDate);

  const revenueAgg = await Table.aggregate([
    { $match: { status: 'completed', ...dateMatch } },
    { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
  ]);

  const expenseAgg = await Expense.aggregate([
    { $match: { ...(startDate || endDate ? { date: dateMatch.createdAt } : {}) } },
    { $group: { _id: null, totalExpense: { $sum: '$amount' } } }
  ]);

  const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
  const totalExpense = expenseAgg[0]?.totalExpense || 0;

  res.json({
    success: true,
    data: { totalRevenue, totalExpense, profit: totalRevenue - totalExpense }
  });
});

// @desc    Compare all locations
// @route   GET /api/analytics/compare-locations
const compareLocations = asyncHandler(async (req, res) => {
  const { startDate, endDate, status, sort } = req.query;
  const dateMatch = getDateMatchCriteria(startDate, endDate);

  const revenueByLoc = await Table.aggregate([
    { $match: { status: 'completed', ...dateMatch } },
    { $group: { _id: '$locationId', revenue: { $sum: '$totalAmount' } } }
  ]);

  const expenseByLoc = await Expense.aggregate([
    { $match: { ...(startDate || endDate ? { date: dateMatch.createdAt } : {}) } },
    { $group: { _id: '$locationId', expenses: { $sum: '$amount' } } }
  ]);

  const locQuery = { isPermanentlyDeleted: false };
  if (status) locQuery.status = status;

  const locations = await Location.find(locQuery);

  let comparisonData = locations.map((loc) => {
    const revObj = revenueByLoc.find((r) => r._id.toString() === loc._id.toString());
    const expObj = expenseByLoc.find((e) => e._id.toString() === loc._id.toString());

    const revenue = revObj ? revObj.revenue : 0;
    const expenses = expObj ? expObj.expenses : 0;

    return {
      locationId: loc._id,
      locationName: loc.name,
      city: loc.city,
      status: loc.status,
      revenue,
      expenses,
      profit: revenue - expenses,
    };
  });

  if (sort === 'highest profit') comparisonData.sort((a, b) => b.profit - a.profit);

  res.json({ success: true, data: comparisonData });
});

// @desc    Get advanced analytics for charts
// @route   GET /api/analytics/advanced
// @desc    Get advanced analytics for charts
const getAdvancedAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, locationId, adminId } = req.query;
  let match = {};

  // Security Layer: Role-based Location Restriction
  if (req.user.role === 'branch_admin' || req.user.role === 'staff' || req.user.role === 'chef') {
    // Branch Admin/Staff: Strictly restricted to their ONE assigned location
    match = { locationId: new mongoose.Types.ObjectId(req.user.assignedLocation) };
  } else if (req.user.role === 'admin') {
    // Admin: Restricted to their LIST of accessible locations
    const allowedIds = req.user.accessibleLocations || [];
    
    if (locationId && locationId !== 'all') {
      // Trying to view a specific location
      if (allowedIds.some(id => id.toString() === locationId)) {
        match = { locationId: new mongoose.Types.ObjectId(locationId.toString()) };
      } else {
        // Unauthorized access attempt to a location not in their list
        match = { locationId: { $in: [] } }; // Return empty data
      }
    } else {
      // Trying to view "All" - restricted to their allowed subset
      match = { locationId: { $in: allowedIds.map(id => new mongoose.Types.ObjectId(id.toString())) } };
    }
  } else if (req.user.role === 'super_admin') {
    // Super Admin: Global access
    if (locationId && locationId !== 'all') {
      match = { locationId: new mongoose.Types.ObjectId(locationId) };
    }
  }

  // Personnel Filtering: Admin/Super Admin can filter by who created/managed the records
  if (adminId && (req.user.role === 'super_admin' || req.user.role === 'admin')) {
    match.createdBy = new mongoose.Types.ObjectId(adminId);
  }

  const dateMatch = getDateMatchCriteria(startDate, endDate, null, 'date');
  const transactionMatch = { ...match, ...dateMatch };
  const expenseMatch = { ...match, ...dateMatch, type: 'expense', status: 'approved' };

  // 1. Transaction Aggregation (Revenue, Profit, Orders)
  const transactionAgg = await Transaction.aggregate([
    { $match: { ...transactionMatch, type: { $ne: 'expense' } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        revenue: { $sum: "$totalAmount" },
        profit: { $sum: "$totalProfit" },
        orders: { $sum: { $cond: [{ $ne: ["$type", "expense"] }, 1, 0] } }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  // 2. Expense Aggregation (Operational Costs)
  const expenseAgg = await Transaction.aggregate([
    { $match: { ...transactionMatch, type: 'expense' } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        expenses: { $sum: "$totalAmount" }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  // 3. Merge Time Series
  const dates = Array.from(new Set([...transactionAgg.map(t => t._id), ...expenseAgg.map(e => e._id)])).sort();
  const timeSeries = dates.map(date => {
    const t = transactionAgg.find(item => item._id === date) || { revenue: 0, profit: 0, orders: 0 };
    const e = expenseAgg.find(item => item._id === date) || { expenses: 0 };
    return {
      date,
      revenue: t.revenue,
      profit: t.profit,
      expenses: e.expenses,
      orders: t.orders
    };
  });

  // 3.5 Personnel & Salary Data (Role-based)
  let personnelStats = null;
  if (req.user.role === 'admin' || req.user.role === 'super_admin') {
    const userMatch = { ...match };
    // Exclude super admins and admins from the personnel salary list for privacy/security
    userMatch.role = { $in: ['branch_admin', 'staff', 'chef'] };
    
    const personnelAgg = await User.aggregate([
      { $match: userMatch },
      {
        $group: {
          _id: null,
          totalMonthlySalary: { $sum: "$monthlySalary" },
          staffCount: { $sum: { $cond: [{ $eq: ["$role", "staff"] }, 1, 0] } },
          chefCount: { $sum: { $cond: [{ $eq: ["$role", "chef"] }, 1, 0] } },
          adminCount: { $sum: { $cond: [{ $eq: ["$role", "branch_admin"] }, 1, 0] } }
        }
      }
    ]);
    personnelStats = personnelAgg[0] || { totalMonthlySalary: 0, staffCount: 0, chefCount: 0, adminCount: 0 };
  }

  // 4. Summary Stats (Calculate directly from aggregation results for precision)
  const totalRevenue = transactionAgg.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalProfit = transactionAgg.reduce((acc, curr) => acc + curr.profit, 0);
  const totalOrders = transactionAgg.reduce((acc, curr) => acc + curr.orders, 0);
  const totalExpenses = expenseAgg.reduce((acc, curr) => acc + curr.expenses, 0);

  // 5. Staff Performance (from Transactions)
  const staffAgg = await Transaction.aggregate([
    { $match: transactionMatch },
    {
      $lookup: {
        from: "users",
        localField: "staffId",
        foreignField: "_id",
        as: "staff"
      }
    },
    { $unwind: "$staff" },
    {
      $group: {
        _id: "$staff.name",
        revenue: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } }
  ]);

  // 6. Category Sales (from Transactions)
  const categoryAgg = await Transaction.aggregate([
    { $match: transactionMatch },
    { $unwind: "$orders" },
    {
      $lookup: {
        from: "menuitems",
        localField: "orders.menuItemId",
        foreignField: "_id",
        as: "menuItem"
      }
    },
    { $unwind: "$menuItem" },
    {
      $lookup: {
        from: "categories",
        localField: "menuItem.category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category.name",
        value: { $sum: { $multiply: ["$orders.price", "$orders.quantity"] } },
        count: { $sum: "$orders.quantity" }
      }
    },
    { $sort: { value: -1 } },
    { $limit: 10 }
  ]);

  // 7. Recent Expenditures
  const recentExpenses = await Transaction.find({ ...transactionMatch, type: 'expense' })
    .sort({ date: -1, createdAt: -1 })
    .limit(5)
    .populate('locationId', 'name city')
    .populate('createdBy', 'name');

  // 8. Recent Revenues
  const recentRevenues = await Transaction.find({ ...transactionMatch, type: { $ne: 'expense' } })
    .sort({ date: -1, createdAt: -1 })
    .limit(5)
    .populate('locationId', 'name city')
    .populate('staffId', 'name')
    .populate('createdBy', 'name');

  res.json({
    success: true,
    data: {
      timeSeries,
      categorySales: categoryAgg.map(c => ({ name: c._id, value: c.value, count: c.count })),
      staffPerformance: staffAgg.map(s => ({ name: s._id, revenue: s.revenue, totalOrders: s.totalOrders })),
      recentExpenses,
      recentRevenues,
      personnelStats,
      summary: {
        totalRevenue,
        totalExpenses,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        netProfit: totalRevenue - totalExpenses
      }
    }
  });
});



// @desc    Compare multiple locations across key metrics
// @route   GET /api/analytics/location-comparison
const getLocationComparison = asyncHandler(async (req, res) => {
  const { locationIds, startDate, endDate, period } = req.query;
  const ids = locationIds ? locationIds.split(',').map(id => new mongoose.Types.ObjectId(id)) : [];

  const dateMatch = getDateMatchCriteria(startDate, endDate, period, 'date');

  const transactionAgg = await Transaction.aggregate([
    { $match: { locationId: { $in: ids }, ...dateMatch } },
    {
      $group: {
        _id: "$locationId",
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
        profit: { $sum: "$totalProfit" },
        avgOrderValue: { $avg: "$totalAmount" }
      }
    }
  ]);

  const expenseAgg = await Expense.aggregate([
    { $match: { locationId: { $in: ids }, type: 'expense', ...(dateMatch.date ? { date: dateMatch.date } : {}) } },
    { $group: { _id: "$locationId", totalExpense: { $sum: "$amount" } } }
  ]);

  const locations = await Location.find({ _id: { $in: ids } }, 'name city');

  const comparisonData = locations.map(loc => {
    const trans = transactionAgg.find(t => t._id.toString() === loc._id.toString()) || { revenue: 0, orders: 0, profit: 0, avgOrderValue: 0 };
    const exp = expenseAgg.find(e => e._id.toString() === loc._id.toString()) || { totalExpense: 0 };

    // Net Profit = (Transaction Profit) - (Operational Expenses)
    // Transaction Profit is (Price - CostPrice) of items. 
    // Operational Expenses are things like rent, electricity added via Expense model.
    return {
      locationId: loc._id,
      name: loc.name,
      city: loc.city,
      revenue: trans.revenue,
      orders: trans.orders,
      expenses: exp.totalExpense,
      netProfit: trans.profit - exp.totalExpense,
      avgOrderValue: trans.avgOrderValue
    };
  });

  res.json({ success: true, data: comparisonData });
});

// @desc    Identify most profitable location
// @route   GET /api/analytics/top-locations
const getTopLocations = asyncHandler(async (req, res) => {
  const { startDate, endDate, period, locationIds } = req.query;
  const ids = locationIds ? locationIds.split(',').map(id => new mongoose.Types.ObjectId(id)) : [];

  const dateMatch = getDateMatchCriteria(startDate, endDate, period, 'date');
  if (ids.length > 0) {
    dateMatch.locationId = { $in: ids };
  }

  const transactionAgg = await Transaction.aggregate([
    { $match: dateMatch },
    { $group: { _id: "$locationId", revenue: { $sum: "$totalAmount" }, profit: { $sum: "$totalProfit" } } },
    { $sort: { profit: -1 } },
    { $limit: 5 }
  ]);

  const locations = await Location.find({ _id: { $in: transactionAgg.map(t => t._id) } }, 'name city');

  const topLocations = transactionAgg.map(t => {
    const loc = locations.find(l => l._id.toString() === t._id.toString());
    return {
      name: loc?.name || 'Unknown',
      city: loc?.city || 'Unknown',
      revenue: t.revenue,
      profit: t.profit
    };
  });

  res.json({ success: true, data: topLocations });
});

// @desc    Track trending and most sold items
// @route   GET /api/analytics/trending-items
const getTrendingItems = asyncHandler(async (req, res) => {
  const { locationId, locationIds, period = 7, startDate, endDate } = req.query;

  let currentPeriodStart, currentPeriodEnd, previousPeriodStart;

  if (startDate || endDate) {
    currentPeriodEnd = endDate ? new Date(endDate) : new Date();
    currentPeriodStart = startDate ? new Date(startDate) : new Date(currentPeriodEnd);
    if (!startDate) currentPeriodStart.setDate(currentPeriodEnd.getDate() - 7);

    const duration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    previousPeriodStart = new Date(currentPeriodStart.getTime() - duration);
  } else {
    const days = period === 'week' ? 7 : (period === 'month' ? 30 : (period === 'year' ? 365 : parseInt(period)));
    currentPeriodEnd = new Date();
    currentPeriodStart = new Date();
    currentPeriodStart.setDate(currentPeriodEnd.getDate() - days);
    previousPeriodStart = new Date();
    previousPeriodStart.setDate(currentPeriodStart.getDate() - days);
  }

  const ids = locationIds ? locationIds.split(',').map(id => new mongoose.Types.ObjectId(id)) : (locationId ? [new mongoose.Types.ObjectId(locationId)] : []);
  const matchCriteria = ids.length > 0 ? { locationId: { $in: ids } } : {};

  // Current Period Sales
  const currentSales = await Transaction.aggregate([
    { $match: { ...matchCriteria, date: { $gte: currentPeriodStart, $lte: currentPeriodEnd } } },
    { $unwind: "$orders" },
    {
      $group: {
        _id: "$orders.menuItemId",
        name: { $first: "$orders.itemName" },
        currentQty: { $sum: "$orders.quantity" },
        revenue: { $sum: { $multiply: ["$orders.price", "$orders.quantity"] } },
        profit: { $sum: { $multiply: [{ $subtract: ["$orders.price", "$orders.costPrice"] }, "$orders.quantity"] } }
      }
    }
  ]);

  // Previous Period Sales
  const previousSales = await Transaction.aggregate([
    { $match: { ...matchCriteria, date: { $gte: previousPeriodStart, $lt: currentPeriodStart } } },
    { $unwind: "$orders" },
    { $group: { _id: "$orders.menuItemId", previousQty: { $sum: "$orders.quantity" } } }
  ]);

  const trends = currentSales.map(curr => {
    const prev = previousSales.find(p => p._id.toString() === curr._id.toString()) || { previousQty: 0 };
    const growth = prev.previousQty === 0 ? 100 : ((curr.currentQty - prev.previousQty) / prev.previousQty) * 100;

    return {
      itemId: curr._id,
      name: curr.name,
      totalSold: curr.currentQty,
      revenue: curr.revenue,
      profit: curr.profit,
      growth: Math.round(growth)
    };
  }).sort((a, b) => b.totalSold - a.totalSold);

  res.json({ success: true, data: trends });
});

// @desc    Detect underperforming locations
// @route   GET /api/analytics/underperforming-locations
const getUnderperformingLocations = asyncHandler(async (req, res) => {
  const { startDate, endDate, period, locationIds } = req.query;
  const ids = locationIds ? locationIds.split(',').map(id => new mongoose.Types.ObjectId(id)) : [];

  const dateMatch = getDateMatchCriteria(startDate, endDate, period || 30, 'date');
  if (ids.length > 0) {
    dateMatch.locationId = { $in: ids };
  }

  const transactionAgg = await Transaction.aggregate([
    { $match: dateMatch }, // Use dynamic date filter
    {
      $group: {
        _id: "$locationId",
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" }
      }
    }
  ]);

  const locations = await Location.find({ isPermanentlyDeleted: false }, 'name city status');

  const results = locations.map(loc => {
    const stats = transactionAgg.find(t => t._id.toString() === loc._id.toString()) || { totalOrders: 0, totalRevenue: 0 };

    // Utilization Score = (orders + revenue_weight) - idle_penalty
    // Simplified: Revenue per order vs overhead
    const score = (stats.totalOrders * 10) + (stats.totalRevenue / 1000);

    let alert = 'stable';
    let reason = '';

    if (score < 50) {
      alert = 'critical';
      reason = 'Low footfall and revenue';
    } else if (score < 150) {
      alert = 'warning';
      reason = 'Below average operational engagement';
    }

    return {
      locationId: loc._id,
      name: loc.name,
      city: loc.city,
      score: Math.round(score),
      alert,
      reason,
      orders: stats.totalOrders,
      revenue: stats.totalRevenue
    };
  }).sort((a, b) => a.score - b.score);

  res.json({ success: true, data: results });
});

// @desc    Product performance breakdown per location
// @route   GET /api/analytics/product-performance/:locationId
const getProductPerformance = asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const { startDate, endDate, period } = req.query;

  const match = { locationId: new mongoose.Types.ObjectId(locationId) };
  if (period) {
    const days = parseInt(period);
    match.date = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  } else if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }

  const performanceAgg = await Transaction.aggregate([
    { $match: match },
    { $unwind: "$orders" },
    {
      $group: {
        _id: "$orders.menuItemId",
        name: { $first: "$orders.itemName" },
        quantity: { $sum: "$orders.quantity" },
        revenue: { $sum: { $multiply: ["$orders.price", "$orders.quantity"] } },
        profit: { $sum: { $multiply: [{ $subtract: ["$orders.price", "$orders.costPrice"] }, "$orders.quantity"] } }
      }
    },
    { $sort: { quantity: -1 } }
  ]);

  res.json({ success: true, data: performanceAgg });
});

// @desc    Get detailed comparison between locations (staff, items, winners)
// @route   GET /api/analytics/comparison-details
const getComparisonDetails = asyncHandler(async (req, res) => {
  const { locationIds, startDate, endDate, period } = req.query;
  if (!locationIds) {
    return res.status(400).json({ success: false, message: "Location IDs are required" });
  }

  const ids = locationIds.split(',').map(id => new mongoose.Types.ObjectId(id));
  const dateMatch = getDateMatchCriteria(startDate, endDate, period, 'date');

  // 1. Staff-Item Breakdown for each location
  const detailedAgg = await Transaction.aggregate([
    { $match: { locationId: { $in: ids }, ...dateMatch } },
    { $unwind: "$orders" },
    {
      $lookup: {
        from: "users",
        localField: "staffId",
        foreignField: "_id",
        as: "staff"
      }
    },
    { $unwind: "$staff" },
    {
      $group: {
        _id: {
          locationId: "$locationId",
          staffId: "$staffId",
          staffName: "$staff.name",
          itemId: "$orders.menuItemId",
          itemName: "$orders.itemName"
        },
        quantity: { $sum: "$orders.quantity" },
        revenue: { $sum: { $multiply: ["$orders.price", "$orders.quantity"] } }
      }
    },
    { $sort: { quantity: -1 } }
  ]);

  // 3. Attendance Aggregation
  const attendanceAgg = await Attendance.aggregate([
    { $match: { locationId: { $in: ids }, date: { $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] } } },
    {
      $group: {
        _id: { locationId: "$locationId", status: "$status" },
        count: { $sum: 1 }
      }
    }
  ]);

  // 4. Format data by location
  const results = ids.map(id => {
    const locData = detailedAgg.filter(d => d._id.locationId.equals(id));
    const locAttendance = attendanceAgg.filter(a => a._id.locationId.equals(id));

    const attendanceStats = {
      present: locAttendance.find(a => a._id.status === 'present')?.count || 0,
      absent: locAttendance.find(a => a._id.status === 'absent')?.count || 0,
      halfDay: locAttendance.find(a => a._id.status === 'half-day')?.count || 0
    };
    const totalAttendance = attendanceStats.present + attendanceStats.absent + attendanceStats.halfDay;
    attendanceStats.rate = totalAttendance > 0 ? ((attendanceStats.present / totalAttendance) * 100).toFixed(1) : 0;

    // Group by staff
    const staffBreakdown = [];
    locData.forEach(d => {
      let staff = staffBreakdown.find(s => s.staffId.equals(d._id.staffId));
      if (!staff) {
        staff = { staffId: d._id.staffId, name: d._id.staffName, items: [] };
        staffBreakdown.push(staff);
      }
      staff.items.push({
        itemId: d._id.itemId,
        name: d._id.itemName,
        quantity: d.quantity,
        revenue: d.revenue
      });
    });

    return {
      locationId: id,
      staffSales: staffBreakdown,
      topItem: locData[0] ? { name: locData[0]._id.itemName, quantity: locData[0].quantity } : null,
      attendance: attendanceStats
    };
  });

  res.json({ success: true, data: results });
});

// @desc    Get intelligence for a single location hub
// @route   GET /api/analytics/location-intelligence/:id
// @access  Private (Admin, Super Admin)
const getLocationIntelligence = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // 1. Fiscal Performance (Current Month)
  const financialStats = await Transaction.aggregate([
    {
      $match: {
        locationId: new mongoose.Types.ObjectId(id),
        date: { $gte: startOfMonth },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$totalAmount' },
        profit: { $sum: '$totalProfit' }
      }
    }
  ]);

  // 2. Expense Metrics
  const expenseStats = await Expense.aggregate([
    {
      $match: {
        locationId: new mongoose.Types.ObjectId(id),
        date: { $gte: startOfMonth },
        status: 'approved'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  // 3. Workforce Stability (Attendance Rate)
  const attendanceStats = await Attendance.aggregate([
    {
      $match: {
        locationId: new mongoose.Types.ObjectId(id),
        date: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: null,
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        total: { $sum: 1 }
      }
    }
  ]);

  const stats = {
    revenue: financialStats[0]?.revenue || 0,
    profit: financialStats[0]?.profit || 0,
    expenses: expenseStats[0]?.total || 0,
    attendanceRate: attendanceStats[0]?.total > 0
      ? (attendanceStats[0].present / attendanceStats[0].total) * 100
      : 100
  };

  res.json({
    success: true,
    data: stats
  });
});

module.exports = {
  getLocationAnalytics,
  getAllAnalytics,
  compareLocations,
  getAdvancedAnalytics,
  getLocationComparison,
  getTopLocations,
  getTrendingItems,
  getUnderperformingLocations,
  getProductPerformance,
  getComparisonDetails,
  getLocationIntelligence
};
