const mongoose = require('mongoose');
const Table = require('../models/Table');
const Expense = require('../models/Expense');
const Location = require('../models/Location');
const Attendance = require('../models/Attendance');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Order = require('../models/Order');
const Payroll = require('../models/Payroll');
const Reservation = require('../models/Reservation');
const CashSession = require('../models/CashSession');
const AuditLog = require('../models/AuditLog');
const WasteRecord = require('../models/WasteRecord');
const asyncHandler = require('../utils/asyncHandler');
const { scopedLocationId, scopedLocationIds, normalizeId, canAccessLocation, userLocationIds, escapeRegex, endOfDay, clampLimit } = require('../utils/accessControl');

// Returns a Mongoose $in array for the current user's accessible locations, or null for super_admin (no filter)
const allowedLocationFilter = (user) => {
  if (user.role === 'super_admin') return null;
  const ids = userLocationIds(user);
  return ids.map(id => new mongoose.Types.ObjectId(id));
};
const AnalyticsService = require('../services/analyticsService');

const COMPLETED_ORDER_STATUSES = ['SERVED', 'COMPLETED'];
const ORDER_STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
const PAYMENT_TYPES = ['CASH', 'CARD', 'UPI', 'ONLINE', 'GIFT_CARD', 'OTHER'];
const ORDER_TYPES = ['dine-in', 'takeaway', 'delivery'];

const buildDateRange = ({ date, startDate, endDate, month, financialYear } = {}) => {
  let start = null;
  let end = null;

  if (date) {
    start = new Date(date);
    start.setHours(0, 0, 0, 0);
    end = endOfDay(date);
  } else if (month) {
    const [year, m] = String(month).split('-').map(Number);
    if (year && m) {
      start = new Date(year, m - 1, 1);
      end = new Date(year, m, 0, 23, 59, 59, 999);
    }
  } else if (financialYear) {
    const year = Number(financialYear);
    if (year) {
      start = new Date(year, 3, 1);
      end = new Date(year + 1, 2, 31, 23, 59, 59, 999);
    }
  } else if (startDate || endDate) {
    if (startDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
    }
    if (endDate) end = endOfDay(endDate);
  }

  if (!start && !end) return null;
  return {
    ...(start ? { $gte: start } : {}),
    ...(end ? { $lte: end } : {})
  };
};

const buildDateStringRange = (dateRange) => {
  if (!dateRange) return null;
  return {
    ...(dateRange.$gte ? { $gte: dateRange.$gte.toISOString().slice(0, 10) } : {}),
    ...(dateRange.$lte ? { $lte: dateRange.$lte.toISOString().slice(0, 10) } : {})
  };
};

// Use `||` not `??`: served-but-unbilled orders have grandTotal === 0 (the final
// GST-inclusive total is only computed at billing), so fall back to the subtotal
// (totalAmount) instead of keeping the literal 0.
const amountOfOrder = (order) => Number(order.grandTotal || order.totalAmount || 0) || 0;

const sameId = (a, b) => normalizeId(a) === normalizeId(b);

const getOrderInvolvement = (order, staffId) => {
  const roles = [];
  if (sameId(order.createdBy, staffId)) roles.push('Created');
  if (sameId(order.assignedChef, staffId)) roles.push('Chef');
  if (sameId(order.servedBy, staffId)) roles.push('Served');

  const touchedStatuses = new Set();
  (order.statusHistory || []).forEach((entry) => {
    if (sameId(entry.updatedBy, staffId) && entry.status) {
      touchedStatuses.add(entry.status);
    }
  });
  touchedStatuses.forEach((status) => roles.push(`Updated ${status}`));

  return [...new Set(roles)];
};

const summarizeAttendance = (records) => {
  const summary = { present: 0, absent: 0, halfDay: 0, leave: 0, weekOff: 0, workedMinutes: 0 };
  records.forEach((record) => {
    if (record.status === 'present') summary.present += 1;
    else if (record.status === 'absent') summary.absent += 1;
    else if (record.status === 'half-day') summary.halfDay += 1;
    else if (record.status === 'leave') summary.leave += 1;
    else if (record.status === 'week-off') summary.weekOff += 1;
    summary.workedMinutes += Number(record.workedMinutes || 0);
  });
  return summary;
};

// @desc    Get analytics for a specific location
// @route   GET /api/analytics/location
// @access  Private
// @desc    Get analytics for a specific location
const getLocationAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, locationId } = req.query;
  const targetLocation = locationId || req.user.assignedLocation;

  if (!targetLocation) {
    res.status(400);
    throw new Error('Location ID is required');
  }
  if (!canAccessLocation(req.user, targetLocation)) {
    res.status(403);
    throw new Error('You do not have permission to view this location');
  }

  const metrics = await AnalyticsService.getLocationMetrics(targetLocation, startDate, endDate);
  res.json({ success: true, data: metrics });
});

// @desc    Get global analytics
// @route   GET /api/analytics/all
// @desc    Get global analytics
const getAllAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, locationId, locationIds, period } = req.query;
  const matchScope = {};

  if (locationIds) {
    const multi = scopedLocationIds(req, locationIds);
    if (multi) matchScope.locationId = multi;
  } else {
    const branch = scopedLocationId(req, locationId);
    if (branch) matchScope.locationId = branch;
  }

  const metrics = await AnalyticsService.getGlobalMetrics(matchScope, startDate, endDate, period);
  res.json({ success: true, data: metrics });
});

// @desc    Compare all locations
const compareLocations = asyncHandler(async (req, res) => {
  const { startDate, endDate, status, sort } = req.query;
  const locQuery = { isPermanentlyDeleted: false };
  const allowedIds = allowedLocationFilter(req.user);
  if (allowedIds) locQuery._id = { $in: allowedIds };
  const ids = await Location.find(locQuery).select('_id');
  const metrics = await AnalyticsService.getLocationOutliers(ids.map(l => l._id), startDate, endDate, null);

  let comparisonData = metrics.map(m => ({
    locationId: m.locationId,
    locationName: m.name,
    city: m.city,
    revenue: m.revenue,
    expenses: m.expenses,
    profit: m.netProfit
  }));

  if (sort === 'highest profit') comparisonData.sort((a, b) => b.profit - a.profit);
  res.json({ success: true, data: comparisonData });
});

// @desc    Get advanced analytics for charts
// @route   GET /api/analytics/advanced
// @desc    Get advanced analytics for charts
// @desc    Get advanced analytics for charts
const getAdvancedAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, locationId, locationIds, adminId } = req.query;
  const matchScope = {};

  // Multi-branch subset takes priority over single locationId
  if (locationIds) {
    const multi = scopedLocationIds(req, locationIds);
    if (multi) matchScope.locationId = { $in: multi.$in.map(id => new mongoose.Types.ObjectId(id)) };
  } else {
    const branch = scopedLocationId(req, locationId);
    if (branch) {
      if (typeof branch === 'object' && branch.$in) {
        matchScope.locationId = { $in: branch.$in.map(id => new mongoose.Types.ObjectId(id.toString())) };
      } else {
        matchScope.locationId = new mongoose.Types.ObjectId(branch.toString());
      }
    }
  }

  const analytics = await AnalyticsService.getAdvancedAnalytics(matchScope, startDate, endDate, adminId, req.user.role);
  res.json({ success: true, data: analytics });
});



// @desc    Compare multiple locations across key metrics
// @route   GET /api/analytics/location-comparison
// @desc    Compare multiple locations across key metrics
const getLocationComparison = asyncHandler(async (req, res) => {
  const { locationIds, startDate, endDate, period } = req.query;
  const rawIds = locationIds ? locationIds.split(',') : [];

  if (req.user.role !== 'super_admin' && rawIds.length > 0) {
    const unauthorized = rawIds.some(id => !canAccessLocation(req.user, id));
    if (unauthorized) {
      res.status(403);
      throw new Error('You do not have permission to compare one or more of these branches');
    }
  }

  const ids = rawIds.length > 0
    ? rawIds.map(id => new mongoose.Types.ObjectId(id))
    : userLocationIds(req.user).map(id => new mongoose.Types.ObjectId(id));

  const metrics = await AnalyticsService.getLocationOutliers(ids, startDate, endDate, period);
  res.json({ success: true, data: metrics });
});

// @desc    Identify most profitable location
const getTopLocations = asyncHandler(async (req, res) => {
  const { startDate, endDate, period, locationIds } = req.query;
  const scopedIds = locationIds ? scopedLocationIds(req, locationIds) : null;
  const ids = scopedIds
    ? scopedIds.$in.map(id => new mongoose.Types.ObjectId(id))
    : userLocationIds(req.user).map(id => new mongoose.Types.ObjectId(id));
  
  const metrics = await AnalyticsService.getLocationOutliers(ids, startDate, endDate, period);
  const topLocations = metrics
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 5)
    .map(m => ({
      name: m.name,
      city: m.city,
      revenue: m.revenue,
      profit: m.netProfit
    }));

  res.json({ success: true, data: topLocations });
});

// @desc    Track trending and most sold items
// @route   GET /api/analytics/trending-items
// @desc    Track trending and most sold items
const getTrendingItems = asyncHandler(async (req, res) => {
  const { locationId, locationIds, period = 7, startDate, endDate } = req.query;
  const matchScope = {};
  if (locationIds) {
    const multi = scopedLocationIds(req, locationIds);
    if (multi) matchScope.locationId = { $in: multi.$in.map(id => new mongoose.Types.ObjectId(id)) };
  } else {
    const branch = scopedLocationId(req, locationId);
    if (branch) matchScope.locationId = branch;
  }

  const trends = await AnalyticsService.getTrendingItems(matchScope, period, startDate, endDate);
  res.json({ success: true, data: trends });
});

// @desc    Detect underperforming locations
// @route   GET /api/analytics/underperforming-locations
const getUnderperformingLocations = asyncHandler(async (req, res) => {
  const { startDate, endDate, period, locationIds } = req.query;
  const scopedIds = locationIds ? scopedLocationIds(req, locationIds) : null;
  const ids = scopedIds ? scopedIds.$in.map(id => new mongoose.Types.ObjectId(id)) : [];

  const dateMatch = AnalyticsService.getDateMatchCriteria(startDate, endDate, period || 30, 'date');
  const allowedForQuery = ids.length > 0 ? ids : (allowedLocationFilter(req.user) || null);
  if (allowedForQuery) {
    dateMatch.locationId = { $in: allowedForQuery };
  }

  const transactionAgg = await Transaction.aggregate([
    {
      // Revenue must count ONLY approved revenue transactions. Matching on the
      // date/location filter alone folded EXPENSE rows and unapproved (pending /
      // rejected) transactions into each branch's "revenue" and counted them as
      // orders, skewing the whole comparison.
      $match: {
        ...dateMatch,
        type: { $in: ['REVENUE', 'POS_REVENUE', 'MANUAL_REVENUE'] },
        status: 'approved',
      },
    },
    {
      $group: {
        _id: "$locationId",
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" }
      }
    }
  ]);

  // Exclude soft-deleted branches so closed outlets don't pad the comparison.
  const locationFilter = { isPermanentlyDeleted: false, status: { $ne: 'deleted' } };
  if (allowedForQuery) locationFilter._id = { $in: allowedForQuery };
  const locations = await Location.find(locationFilter, 'name city status');

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
  if (!canAccessLocation(req.user, locationId)) {
    res.status(403);
    throw new Error('You do not have access to this location');
  }

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

  const rawIds = locationIds.split(',');
  const unauthorized = rawIds.filter(id => !canAccessLocation(req.user, id));
  if (unauthorized.length > 0) {
    res.status(403);
    throw new Error('Access denied to one or more requested locations');
  }
  const ids = rawIds.map(id => new mongoose.Types.ObjectId(id));
  const dateMatch = AnalyticsService.getDateMatchCriteria(startDate, endDate, period, 'date');

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
  // Attendance.date is a 'YYYY-MM-DD' STRING, so this window is built from string
  // bounds (lexicographic ordering is correct for that format) rather than the
  // Date-based dateMatch used above. It now honours endDate/period — previously it
  // was open-ended, so attendance covered a different window than the revenue it
  // is compared against.
  const attWindowDays = Number(period) || 30;
  const attStart = String(startDate || new Date(Date.now() - attWindowDays * 24 * 60 * 60 * 1000).toISOString()).slice(0, 10);
  const attEnd = String(endDate || new Date().toISOString()).slice(0, 10);
  const attendanceAgg = await Attendance.aggregate([
    { $match: { locationId: { $in: ids }, date: { $gte: attStart, $lte: attEnd } } },
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
const getLocationInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!canAccessLocation(req.user, id)) {
    res.status(403);
    throw new Error('You do not have access to this location');
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // 1. Fiscal Performance (Current Month)
  const financialStats = await Transaction.aggregate([
    {
      $match: {
        locationId: new mongoose.Types.ObjectId(id),
        date: { $gte: startOfMonth },
        type: { $in: ['REVENUE', 'POS_REVENUE', 'MANUAL_REVENUE'] },
        status: 'approved'
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
  // Exclude INCOME-typed Expense docs (e.g. reservation advances, which are also
  // counted as revenue via MANUAL_REVENUE). Summing them here as a cost
  // double-counted booking income against profit.
  const expenseStats = await Expense.aggregate([
    {
      $match: {
        locationId: new mongoose.Types.ObjectId(id),
        date: { $gte: startOfMonth },
        status: 'approved',
        type: { $ne: 'INCOME' }
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

const getStaffReports = asyncHandler(async (req, res) => {
  const Order = require('../models/Order');
  const User = require('../models/User');
  const { staffName, branch, date, month, financialYear } = req.query;

  let orderQuery = {};
  const branchScope = scopedLocationId(req, branch);
  if (branchScope) orderQuery.branch = branchScope;

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    orderQuery.createdAt = { $gte: start, $lte: end };
  } else if (month) {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59, 999);
    orderQuery.createdAt = { $gte: start, $lte: end };
  } else if (financialYear) {
    const year = Number(financialYear);
    const start = new Date(year, 3, 1);
    const end = new Date(year + 1, 2, 31, 23, 59, 59, 999);
    orderQuery.createdAt = { $gte: start, $lte: end };
  }

  // A branch_admin's staff report covers only their staff/chef — never peer
  // branch_admins or themselves. Admin/super_admin keep the fuller hierarchy view.
  const reportRoles = ['branch_admin', 'location_admin'].includes(req.user.role)
    ? ['staff', 'chef']
    : ['staff', 'chef', 'branch_admin'];
  let userQuery = { role: { $in: reportRoles } };
  if (staffName) {
    userQuery.name = { $regex: escapeRegex(staffName), $options: 'i' };
  }
  // Scope to accessible locations for all non-super_admin roles
  if (req.user.role !== 'super_admin') {
    const allowedIds = allowedLocationFilter(req.user);
    userQuery.assignedLocation = { $in: allowedIds };
  }
  userQuery.deletedAt = null; // a removed person is no longer current staff
  const users = await User.find(userQuery).populate('assignedLocation', 'name');
  const userIds = users.map(u => u._id.toString());

  const orders = await Order.find(orderQuery)
    .populate('coupon')
    .populate({ path: 'items.menuItem', populate: { path: 'category', select: 'name' } });

  const staffStats = {};
  users.forEach(u => {
    staffStats[u._id.toString()] = {
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      branchName: u.assignedLocation?.name || 'All',
      totalSales: 0,
      ordersHandled: 0,
      couponUsageCount: 0,
      couponDiscountAmount: 0,
      revenueGenerated: 0,
      estimatedProfit: 0,
      cancelledCount: 0,
      totalCount: 0,
      foodCategorySales: {}
    };
  });

  orders.forEach(order => {
    const roles = ['createdBy', 'assignedChef', 'servedBy'];
    const orderStaffIds = new Set();
    roles.forEach(roleField => {
      if (order[roleField]) {
        const sid = order[roleField].toString();
        if (userIds.includes(sid)) {
          orderStaffIds.add(sid);
        }
      }
    });

    let orderProfit = 0;
    order.items.forEach(it => {
      if (it.menuItem) {
        const price = it.menuItem.price || 0;
        const cost = it.menuItem.costPrice || 0;
        orderProfit += (price - cost) * it.quantity;
      }
    });

    let discountAmount = 0;
    if (order.coupon) {
      if (order.coupon.discountType === 'percentage') {
        discountAmount = (order.totalAmount * order.coupon.discountValue) / 100;
        if (order.coupon.maxDiscount && discountAmount > order.coupon.maxDiscount) {
          discountAmount = order.coupon.maxDiscount;
        }
      } else {
        discountAmount = order.coupon.discountValue;
      }
    }

    orderStaffIds.forEach(sid => {
      const stats = staffStats[sid];
      stats.totalCount += 1;
      stats.ordersHandled += 1;

      if (order.status === 'SERVED' || order.status === 'COMPLETED') {
        stats.totalSales += order.totalAmount;
        stats.revenueGenerated += order.totalAmount;
        stats.estimatedProfit += orderProfit;

        if (order.coupon) {
          stats.couponUsageCount += 1;
          stats.couponDiscountAmount += discountAmount;
        }

        order.items.forEach(it => {
          if (it.menuItem && it.menuItem.category) {
            const catName = it.menuItem.category.name;
            const salesValue = (it.menuItem.price || 0) * it.quantity;
            stats.foodCategorySales[catName] = (stats.foodCategorySales[catName] || 0) + salesValue;
          }
        });
      }

      if (order.status === 'CANCELLED') {
        stats.cancelledCount += 1;
      }
    });
  });

  const finalReport = Object.values(staffStats).map(stats => {
    const cancelledRatio = stats.totalCount > 0 ? (stats.cancelledCount / stats.totalCount) : 0;
    const avgOrderValue = stats.ordersHandled > 0 ? (stats.totalSales / stats.ordersHandled) : 0;
    return {
      ...stats,
      cancelledRatio: (cancelledRatio * 100).toFixed(2) + '%',
      avgOrderValue: avgOrderValue.toFixed(2),
      estimatedProfitContribution: stats.estimatedProfit.toFixed(2),
      totalSales: stats.totalSales.toFixed(2),
      revenueGenerated: stats.revenueGenerated.toFixed(2),
      couponDiscountAmount: stats.couponDiscountAmount.toFixed(2)
    };
  });

  finalReport.sort((a, b) => b.totalSales - a.totalSales);
  finalReport.forEach((stats, index) => {
    stats.ranking = index + 1;
  });

  res.json({ success: true, data: finalReport });
});

const getStaffReportDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    branch,
    status,
    paymentType,
    orderType,
    reservationStatus,
    expenseStatus,
    expenseType
  } = req.query;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400);
    throw new Error('Invalid staff member ID');
  }

  const staffObjectId = new mongoose.Types.ObjectId(id);
  const staff = await User.findById(id)
    .select('name email phone role assignedLocation accessibleLocations profileImageUrl monthlySalary active isBlocked city state')
    .populate('assignedLocation', 'name city')
    .populate('accessibleLocations', 'name city')
    .lean();

  if (!staff) {
    res.status(404);
    throw new Error('Staff member not found');
  }

  if (req.user.role !== 'super_admin') {
    const targetLocationIds = userLocationIds(staff);
    const hasLocationAccess = targetLocationIds.some((locId) => canAccessLocation(req.user, locId));
    if (!hasLocationAccess) {
      res.status(403);
      throw new Error('You do not have permission to view this staff report');
    }
  }

  const dateRange = buildDateRange(req.query);
  const dateStringRange = buildDateStringRange(dateRange);
  const branchScope = scopedLocationId(req, branch);
  const limit = clampLimit(req.query.limit, 500, 2000);

  const orderQuery = {
    $or: [
      { createdBy: staffObjectId },
      { assignedChef: staffObjectId },
      { servedBy: staffObjectId },
      { 'statusHistory.updatedBy': staffObjectId }
    ]
  };
  if (dateRange) orderQuery.createdAt = dateRange;
  if (branchScope) orderQuery.branch = branchScope;
  if (status && ORDER_STATUSES.includes(status)) orderQuery.status = status;
  if (paymentType && PAYMENT_TYPES.includes(paymentType)) orderQuery.paymentType = paymentType;
  if (orderType && ORDER_TYPES.includes(orderType)) orderQuery.orderType = orderType;

  const reservationQuery = { userId: staffObjectId };
  if (dateRange) reservationQuery.date = dateRange;
  if (branchScope) reservationQuery.locationId = branchScope;
  if (reservationStatus && ['pending', 'confirmed', 'cancelled', 'no-show'].includes(reservationStatus)) {
    reservationQuery.status = reservationStatus;
  }

  const attendanceQuery = { user: staffObjectId };
  if (dateStringRange) attendanceQuery.date = dateStringRange;
  if (branchScope) attendanceQuery.locationId = branchScope;

  const expenseQuery = { createdBy: staffObjectId };
  if (dateRange) expenseQuery.date = dateRange;
  if (branchScope) expenseQuery.locationId = branchScope;
  if (expenseStatus && ['pending', 'approved', 'rejected', 'live', 'completed'].includes(expenseStatus)) {
    expenseQuery.status = expenseStatus;
  }
  if (expenseType && ['EXPENSE', 'INCOME'].includes(expenseType)) {
    expenseQuery.type = expenseType;
  }

  const cashSessionClauses = [
    {
      $or: [
        { openedBy: staffObjectId },
        { closedBy: staffObjectId },
        { 'movements.by': staffObjectId }
      ]
    }
  ];
  if (dateRange) {
    cashSessionClauses.push({
      $or: [
        { openedAt: dateRange },
        { closedAt: dateRange },
        { 'movements.at': dateRange }
      ]
    });
  }
  const cashSessionQuery = { $and: cashSessionClauses };
  if (branchScope) cashSessionQuery.locationId = branchScope;

  const auditQuery = { performedBy: staffObjectId };
  if (dateRange) auditQuery.timestamp = dateRange;
  if (branchScope) auditQuery.locationId = branchScope;

  // Ledger entries (manual revenue / expense) this person recorded.
  const transactionQuery = { createdBy: staffObjectId };
  if (dateRange) transactionQuery.date = dateRange;
  if (branchScope) transactionQuery.locationId = branchScope;

  // Inventory waste this person logged (WasteRecord scopes branch as `branch`).
  const wasteQuery = { recordedBy: staffObjectId };
  if (dateRange) wasteQuery.date = dateRange;
  if (branchScope) wasteQuery.branch = branchScope;

  const [
    orders,
    reservations,
    attendance,
    expenses,
    cashSessions,
    activity,
    transactions,
    waste
  ] = await Promise.all([
    Order.find(orderQuery)
      .populate('branch', 'name city')
      .populate('table', 'tableNumber')
      .populate('createdBy', 'name role deletedAt')
      .populate('assignedChef', 'name role deletedAt')
      .populate('servedBy', 'name role deletedAt')
      .populate('coupon', 'code discountType discountValue')
      .populate({ path: 'items.menuItem', select: 'name price costPrice category', populate: { path: 'category', select: 'name' } })
      .populate('statusHistory.updatedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Reservation.find(reservationQuery)
      .populate('locationId', 'name city')
      .populate('tableIds', 'tableNumber')
      .sort({ date: -1, startTime: -1 })
      .limit(limit)
      .lean(),
    Attendance.find(attendanceQuery)
      .populate('locationId', 'name city')
      .populate('markedBy', 'name role deletedAt')
      .sort({ date: -1 })
      .limit(limit)
      .lean(),
    Expense.find(expenseQuery)
      .populate('locationId', 'name city')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    CashSession.find(cashSessionQuery)
      .populate('locationId', 'name city')
      .populate('openedBy', 'name role deletedAt')
      .populate('closedBy', 'name role deletedAt')
      .populate('movements.by', 'name role')
      .sort({ openedAt: -1 })
      .limit(limit)
      .lean(),
    AuditLog.find(auditQuery)
      .populate('locationId', 'name city')
      .sort({ timestamp: -1 })
      .limit(50)
      .lean(),
    Transaction.find(transactionQuery)
      .populate('locationId', 'name city')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    WasteRecord.find(wasteQuery)
      .populate('ingredient', 'name unit')
      .populate('branch', 'name city')
      .sort({ date: -1 })
      .limit(limit)
      .lean()
  ]);

  const coupons = {};
  const statusCounts = {};
  const paymentBreakdown = {};
  const orderRoleCounts = { created: 0, chef: 0, served: 0, updated: 0 };
  const categorySales = {};
  const topItems = {};

  let totalSales = 0;
  let estimatedProfit = 0;
  let completedOrders = 0;
  let cancelledOrders = 0;
  let totalDiscount = 0;

  const decoratedOrders = orders.map((order) => {
    const involvedAs = getOrderInvolvement(order, id);
    if (involvedAs.includes('Created')) orderRoleCounts.created += 1;
    if (involvedAs.includes('Chef')) orderRoleCounts.chef += 1;
    if (involvedAs.includes('Served')) orderRoleCounts.served += 1;
    if (involvedAs.some((role) => role.startsWith('Updated '))) orderRoleCounts.updated += 1;

    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    paymentBreakdown[order.paymentType || 'UNKNOWN'] = (paymentBreakdown[order.paymentType || 'UNKNOWN'] || 0) + 1;

    const isCompleted = COMPLETED_ORDER_STATUSES.includes(order.status);
    if (isCompleted) {
      completedOrders += 1;
      totalSales += amountOfOrder(order);
    }
    if (order.status === 'CANCELLED') cancelledOrders += 1;

    const discount = Number(order.discountAmount || 0);
    if (order.coupon || discount > 0) {
      const code = order.coupon?.code || 'Manual discount';
      if (!coupons[code]) {
        coupons[code] = {
          code,
          couponId: order.coupon?._id || null,
          count: 0,
          discount: 0,
          sales: 0,
          lastUsedAt: null
        };
      }
      coupons[code].count += 1;
      coupons[code].discount += discount;
      coupons[code].sales += amountOfOrder(order);
      coupons[code].lastUsedAt = coupons[code].lastUsedAt || order.createdAt;
      totalDiscount += discount;
    }

    (order.items || []).forEach((item) => {
      const name = item.menuItem?.name || item.itemName || 'Item';
      const qty = Number(item.quantity || 0);
      const price = Number(item.price ?? item.menuItem?.price ?? 0);
      const cost = Number(item.costPrice ?? item.menuItem?.costPrice ?? 0);
      const category = item.menuItem?.category?.name || 'Uncategorized';

      if (isCompleted) {
        estimatedProfit += (price - cost) * qty;
        categorySales[category] = (categorySales[category] || 0) + price * qty;
      }
      if (!topItems[name]) topItems[name] = { name, quantity: 0, sales: 0 };
      topItems[name].quantity += qty;
      topItems[name].sales += price * qty;
    });

    return {
      ...order,
      shortId: order._id.toString().slice(-6).toUpperCase(),
      involvedAs,
      itemCount: (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    };
  });

  const reservationRevenue = reservations.reduce((sum, reservation) => sum + Number(reservation.totalAmount || 0), 0);
  const reservationAdvance = reservations.reduce((sum, reservation) => sum + Number(reservation.advancePayment || 0), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const cashVariance = cashSessions.reduce((sum, session) => sum + Number(session.variance || 0), 0);
  const attendanceSummary = summarizeAttendance(attendance);

  // Ledger split: EXPENSE-type entries are costs, everything else is revenue.
  const transactionSummary = transactions.reduce((acc, txn) => {
    const amount = Number(txn.totalAmount || 0);
    if (String(txn.type || '').toUpperCase().includes('EXPENSE')) acc.expense += amount;
    else acc.revenue += amount;
    acc.count += 1;
    return acc;
  }, { count: 0, revenue: 0, expense: 0 });

  const wasteSummary = waste.reduce((acc, record) => {
    acc.count += 1;
    acc.quantity += Number(record.quantity || 0);
    return acc;
  }, { count: 0, quantity: 0 });

  const summary = {
    orders: decoratedOrders.length,
    completedOrders,
    cancelledOrders,
    totalSales,
    averageOrderValue: completedOrders ? totalSales / completedOrders : 0,
    estimatedProfit,
    couponsUsed: Object.values(coupons).reduce((sum, coupon) => sum + coupon.count, 0),
    totalDiscount,
    reservations: reservations.length,
    reservationRevenue,
    reservationAdvance,
    attendance: attendanceSummary,
    expenses: {
      count: expenses.length,
      total: expenseTotal
    },
    cashSessions: {
      count: cashSessions.length,
      variance: cashVariance
    },
    transactions: transactionSummary,
    waste: wasteSummary,
    orderRoleCounts,
    statusCounts,
    paymentBreakdown,
    categorySales: Object.entries(categorySales)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    topItems: Object.values(topItems)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
  };

  res.json({
    success: true,
    data: {
      staff,
      summary,
      orders: decoratedOrders,
      coupons: Object.values(coupons).sort((a, b) => b.count - a.count),
      reservations,
      attendance,
      expenses,
      cashSessions,
      transactions,
      waste,
      activity
    }
  });
});

const getPaymentInfo = asyncHandler(async (req, res) => {
  const Order = require('../models/Order');
  const Location = require('../models/Location');
  const { date, period, startDate, endDate, financialYear, branchId } = req.query;

  let orderQuery = { status: { $in: ['SERVED', 'COMPLETED'] } };

  if (financialYear) {
    const year = Number(financialYear);
    orderQuery.createdAt = {
      $gte: new Date(year, 3, 1),
      $lte: new Date(year + 1, 2, 31, 23, 59, 59, 999)
    };
  } else if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    orderQuery.createdAt = { $gte: start, $lte: end };
  } else if (period) {
    let days;
    if (period === 'week') days = 7;
    else if (period === 'month') days = 30;
    else if (period === 'year') days = 365;
    else days = parseInt(period);

    if (!isNaN(days)) {
      orderQuery.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
  } else if (startDate || endDate) {
    orderQuery.createdAt = {};
    if (startDate) orderQuery.createdAt.$gte = new Date(startDate);
    if (endDate) orderQuery.createdAt.$lte = endOfDay(endDate);
  }

  const branchScope = scopedLocationId(req, branchId);
  if (branchScope) orderQuery.branch = branchScope;

  const orders = await Order.find(orderQuery).populate('branch', 'name');

  let totalUPIOrders = 0;
  let totalCashOrders = 0;
  let upiRevenue = 0;
  let cashRevenue = 0;

  const branchUPIStats = {};
  const trendMap = {};

  const locFilter = { isPermanentlyDeleted: false };
  const paymentAllowed = allowedLocationFilter(req.user);
  if (paymentAllowed) locFilter._id = { $in: paymentAllowed };
  const locations = await Location.find(locFilter);
  locations.forEach(loc => {
    branchUPIStats[loc._id.toString()] = {
      branchId: loc._id,
      branchName: loc.name,
      upiRevenue: 0,
      upiOrders: 0,
      cashRevenue: 0,
      cashOrders: 0
    };
  });

  orders.forEach(order => {
    const amount = order.totalAmount || 0;
    const isUPI = order.paymentType === 'UPI';
    const isCash = order.paymentType === 'CASH';

    const branchId = order.branch?._id?.toString() || order.branch?.toString();

    const dateStr = order.createdAt.toISOString().split('T')[0];
    if (!trendMap[dateStr]) {
      trendMap[dateStr] = { date: dateStr, upi: 0, cash: 0 };
    }

    if (isUPI) {
      totalUPIOrders += 1;
      upiRevenue += amount;
      trendMap[dateStr].upi += amount;
      if (branchUPIStats[branchId]) {
        branchUPIStats[branchId].upiOrders += 1;
        branchUPIStats[branchId].upiRevenue += amount;
      }
    } else if (isCash) {
      totalCashOrders += 1;
      cashRevenue += amount;
      trendMap[dateStr].cash += amount;
      if (branchUPIStats[branchId]) {
        branchUPIStats[branchId].cashOrders += 1;
        branchUPIStats[branchId].cashRevenue += amount;
      }
    }
  });

  const branchStatsArray = Object.values(branchUPIStats);

  let highestUPIBranch = null;
  if (branchStatsArray.length > 0) {
    highestUPIBranch = [...branchStatsArray].sort((a, b) => b.upiRevenue - a.upiRevenue)[0];
  }

  const trendGraph = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    success: true,
    data: {
      totalUPIOrders,
      totalCashOrders,
      upiRevenue: upiRevenue.toFixed(2),
      cashRevenue: cashRevenue.toFixed(2),
      branchUPIStats: branchStatsArray,
      highestUPIBranch: highestUPIBranch ? { name: highestUPIBranch.branchName, revenue: highestUPIBranch.upiRevenue.toFixed(2) } : null,
      trendGraph
    }
  });
});

const getBranchComparisonSuite = asyncHandler(async (req, res) => {
  const Order = require('../models/Order');
  const Location = require('../models/Location');
  const User = require('../models/User');
  const { period } = req.query;

  let currentStart, currentEnd, previousStart, previousEnd;

  const now = new Date();
  if (period === 'month') {
    currentEnd = now;
    currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    previousEnd = currentStart;
    previousStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === 'year') {
    currentEnd = now;
    currentStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    previousEnd = currentStart;
    previousStart = new Date(currentStart.getTime() - 365 * 24 * 60 * 60 * 1000);
  } else if (period === 'FY') {
    // Indian financial year runs Apr 1 - Mar 31. Months 0-2 (Jan-Mar) fall in the
    // FY that started the previous calendar year.
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    currentStart = new Date(fyStartYear, 3, 1); // 1-April
    currentEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999); // 31-March
    previousStart = new Date(fyStartYear - 1, 3, 1);
    previousEnd = new Date(fyStartYear, 2, 31, 23, 59, 59, 999);
  } else {
    // Default to week
    currentEnd = now;
    currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    previousEnd = currentStart;
    previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const compAllowed = allowedLocationFilter(req.user);
  const locQuery = { isPermanentlyDeleted: false };
  const staffQuery = { role: { $in: ['staff', 'chef', 'branch_admin'] }, deletedAt: null };
  if (compAllowed) {
    locQuery._id = { $in: compAllowed };
    staffQuery.assignedLocation = { $in: compAllowed };
  }
  const locations = await Location.find(locQuery).populate('cafe', 'name');
  const users = await User.find(staffQuery);

  const branchScope = scopedLocationId(req, null);
  const orderFilter = {
    createdAt: { $gte: currentStart, $lte: currentEnd }
  };
  if (branchScope) orderFilter.branch = branchScope;

  const currentOrders = await Order.find(orderFilter).populate('coupon').populate('items.menuItem');

  const prevFilter = {
    createdAt: { $gte: previousStart, $lte: previousEnd }
  };
  if (branchScope) prevFilter.branch = branchScope;

  const previousOrders = await Order.find(prevFilter);

  const branchStats = {};
  locations.forEach(loc => {
    branchStats[loc._id.toString()] = {
      _id: loc._id,
      name: loc.name,
      city: loc.city,
      cafeName: loc.cafe?.name || '',
      revenue: 0,
      previousRevenue: 0,
      orders: 0,
      previousOrders: 0,
      upiOrders: 0,
      couponUsage: 0,
      profitability: 0,
      cancelledCount: 0,
      totalCount: 0,
      staffCount: 0
    };
  });

  // Calculate staff counts
  users.forEach(u => {
    if (u.assignedLocation) {
      const bid = u.assignedLocation.toString();
      if (branchStats[bid]) {
        branchStats[bid].staffCount += 1;
      }
    }
  });

  // Previous Orders mapping for growth
  previousOrders.forEach(order => {
    const bid = order.branch?.toString();
    if (branchStats[bid] && (order.status === 'SERVED' || order.status === 'COMPLETED')) {
      branchStats[bid].previousRevenue += (order.totalAmount || 0);
      branchStats[bid].previousOrders += 1;
    }
  });

  // Current Orders mapping
  currentOrders.forEach(order => {
    const bid = order.branch?._id?.toString() || order.branch?.toString();
    if (branchStats[bid]) {
      branchStats[bid].totalCount += 1;

      if (order.status === 'SERVED' || order.status === 'COMPLETED') {
        const amount = order.totalAmount || 0;
        branchStats[bid].revenue += amount;
        branchStats[bid].orders += 1;

        if (order.paymentType === 'UPI') {
          branchStats[bid].upiOrders += 1;
        }

        if (order.coupon) {
          branchStats[bid].couponUsage += 1;
        }

        let orderProfit = 0;
        order.items.forEach(it => {
          if (it.menuItem) {
            const price = it.menuItem.price || 0;
            const cost = it.menuItem.costPrice || 0;
            orderProfit += (price - cost) * it.quantity;
          }
        });
        branchStats[bid].profitability += orderProfit;
      }

      if (order.status === 'CANCELLED') {
        branchStats[bid].cancelledCount += 1;
      }
    }
  });

  const finalArray = Object.values(branchStats).map(stats => {
    // Computations
    const growthPercent = stats.previousRevenue > 0
      ? ((stats.revenue - stats.previousRevenue) / stats.previousRevenue) * 100
      : (stats.revenue > 0 ? 100 : 0);

    const upiPercent = stats.orders > 0 ? (stats.upiOrders / stats.orders) * 100 : 0;
    const avgOrderValue = stats.orders > 0 ? stats.revenue / stats.orders : 0;
    const staffEfficiency = stats.staffCount > 0 ? stats.orders / stats.staffCount : stats.orders;
    const cancellationRate = stats.totalCount > 0 ? (stats.cancelledCount / stats.totalCount) * 100 : 0;

    return {
      _id: stats._id,
      name: stats.name,
      cafeName: stats.cafeName,
      city: stats.city,
      revenue: stats.revenue.toFixed(2),
      orders: stats.orders,
      growthPercent: growthPercent.toFixed(2),
      upiPercent: upiPercent.toFixed(2),
      avgOrderValue: avgOrderValue.toFixed(2),
      staffEfficiency: staffEfficiency.toFixed(2),
      cancellationRate: cancellationRate.toFixed(2),
      couponUsage: stats.couponUsage,
      profitability: stats.profitability.toFixed(2)
    };
  });

  // Identify outliers
  let mostProfitable = null;
  let slowestGrowth = null;
  let lowestPerforming = null;

  if (finalArray.length > 0) {
    mostProfitable = [...finalArray].sort((a, b) => b.profitability - a.profitability)[0];
    slowestGrowth = [...finalArray].sort((a, b) => a.growthPercent - b.growthPercent)[0];
    lowestPerforming = [...finalArray].sort((a, b) => a.revenue - b.revenue)[0];
  }

  res.json({
    success: true,
    data: {
      branches: finalArray,
      outliers: {
        mostProfitable: mostProfitable ? { name: mostProfitable.name, value: mostProfitable.profitability } : null,
        slowestGrowth: slowestGrowth ? { name: slowestGrowth.name, value: slowestGrowth.growthPercent + '%' } : null,
        lowestPerforming: lowestPerforming ? { name: lowestPerforming.name, value: lowestPerforming.revenue } : null
      }
    }
  });
});

const getCommandCenterStats = asyncHandler(async (req, res) => {
  const { branchId } = req.query;
  const branchScope = scopedLocationId(req, branchId);
  const stats = await AnalyticsService.getLiveStats(branchScope);
  res.json({ success: true, data: stats });
});

const getForecastingAnalytics = asyncHandler(async (req, res) => {
  const { branchId, period, startDate, endDate } = req.query;
  const filter = { status: { $in: ['SERVED', 'COMPLETED'] } };

  const branchScope = scopedLocationId(req, branchId);
  if (branchScope) filter.branch = branchScope;

  // Prefer an explicit date range (from the UniversalDateFilter on the dashboard);
  // fall back to the legacy `period` lookback window when no range is supplied.
  let start;
  if (startDate) {
    start = new Date(startDate);
  } else {
    let days = 90; // Default lookback
    if (period === 'today') days = 1;
    else if (period === 'week') days = 7;
    else if (period === 'month') days = 30;
    else if (period === 'year' || period === 'FY') days = 365;
    start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
  filter.createdAt = { $gte: start };
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.createdAt.$lte = end;
  }

  const pastOrders = await Order.find(filter).lean();

  if (pastOrders.length === 0) {
    return res.json({
      success: true,
      data: {
        expectedTodayRevenue: 0,
        weeklyRevenueEstimate: 0,
        nextMonthSalesTrend: [],
        slowBusinessDays: 'N/A',
        peakHoursForecast: 'N/A',
        bestCategoryForecast: 'N/A',
        confidenceScore: 50
      }
    });
  }

  const dayOfWeekSales = Array(7).fill(0);
  const dayOfWeekCounts = Array(7).fill(0);
  const hourlySales = Array(24).fill(0);

  pastOrders.forEach(order => {
    const date = new Date(order.createdAt);
    const day = date.getDay();
    const hour = date.getHours();

    dayOfWeekSales[day] += order.totalAmount || 0;
    dayOfWeekCounts[day] += 1;
    hourlySales[hour] += order.totalAmount || 0;
  });

  const today = new Date().getDay();
  const expectedTodayRevenue = Math.round(dayOfWeekSales[today] / Math.max(dayOfWeekCounts[today] || 1, 1));

  const totalRevenueAllTime = dayOfWeekSales.reduce((a, b) => a + b, 0);
  const weeklyRevenueEstimate = Math.round(totalRevenueAllTime / Math.max(dayOfWeekCounts.reduce((a, b) => a + b, 0) / 7, 1));

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let slowDayIdx = 0;
  let minSales = Number.MAX_VALUE;

  dayOfWeekSales.forEach((sales, idx) => {
    const avg = sales / Math.max(dayOfWeekCounts[idx] || 1, 1);
    if (avg < minSales && dayOfWeekCounts[idx] > 0) {
      minSales = avg;
      slowDayIdx = idx;
    }
  });

  let peakHour = 0;
  let maxHourly = -1;
  hourlySales.forEach((sales, idx) => {
    if (sales > maxHourly) {
      maxHourly = sales;
      peakHour = idx;
    }
  });

  const confidenceScore = pastOrders.length > 500 ? 94 : (pastOrders.length > 100 ? 88 : 70);

  const nextMonthSalesTrend = dayNames.map((name, i) => ({
    day: name,
    projected: Math.round((dayOfWeekSales[i] / Math.max(dayOfWeekCounts[i] || 1, 1)) * 1.05)
  }));

  res.json({
    success: true,
    data: {
      expectedTodayRevenue,
      weeklyRevenueEstimate,
      nextMonthSalesTrend,
      slowBusinessDays: dayNames[slowDayIdx],
      peakHoursForecast: `${peakHour}:00 - ${peakHour + 1}:00`,
      bestCategoryForecast: 'Beverages', // Standardized fallback for simple statistical schemas
      confidenceScore
    }
  });
});

// @desc    Cash flow (money in vs money out) for a single month
// @route   GET /api/analytics/cash-flow
// @access  Private (all roles; staff/chef are scoped to their own activity)
// Money in  = approved revenue transactions (sales collected).
// Money out = approved expenses (split into stock purchases vs other).
// Udhaar    = outstanding balance on completed unpaid/partial orders.
const getCashFlow = asyncHandler(async (req, res) => {
  const { month, locationId, category } = req.query;
  const role = req.user.role;
  const isStaff = role === 'staff' || role === 'chef';

  // Resolve the [start, end) window for the requested YYYY-MM (default: this month).
  const now = new Date();
  let year = now.getFullYear();
  let mon = now.getMonth();
  if (/^\d{4}-\d{2}$/.test(month || '')) {
    const [y, m] = month.split('-').map(Number);
    if (m >= 1 && m <= 12) { year = y; mon = m - 1; }
  }
  const start = new Date(year, mon, 1, 0, 0, 0, 0);
  const end = new Date(year, mon + 1, 1, 0, 0, 0, 0); // exclusive

  // Location scoping. Transactions/Expenses key off `locationId`, Orders off `branch`.
  // Staff/chef ignore location and are pinned to their own records instead.
  const txnLocMatch = {};
  const orderLocMatch = {};
  if (!isStaff) {
    const scoped = scopedLocationId(req, locationId); // string id | { $in: [...] } | null (super_admin all) | throws 403
    if (scoped) {
      const toId = (v) => new mongoose.Types.ObjectId(v);
      if (scoped.$in) {
        txnLocMatch.locationId = { $in: scoped.$in.map(toId) };
        orderLocMatch.branch = { $in: scoped.$in.map(toId) };
      } else {
        txnLocMatch.locationId = toId(scoped);
        orderLocMatch.branch = toId(scoped);
      }
    }
  }

  // Ownership scoping for staff/chef. POS revenue is attributed via staffId, other
  // records via createdBy.
  const uid = new mongoose.Types.ObjectId(req.user._id);
  const txnOwnerMatch = isStaff ? { $or: [{ createdBy: uid }, { staffId: uid }] } : {};
  const ownerMatch = isStaff ? { createdBy: uid } : {};

  // Money in — approved revenue transactions (mirrors the P&L convention).
  const revenueAgg = await Transaction.aggregate([
    {
      $match: {
        ...txnLocMatch,
        ...txnOwnerMatch,
        type: { $in: ['REVENUE', 'POS_REVENUE', 'MANUAL_REVENUE'] },
        status: 'approved',
        date: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  const moneyIn = revenueAgg[0]?.total || 0;

  // Money out — approved expenses grouped by category (INCOME-typed excluded so
  // reservation advances aren't double-counted against revenue).
  const expenseAgg = await Expense.aggregate([
    {
      $match: {
        ...txnLocMatch,
        ...ownerMatch,
        status: 'approved',
        type: { $ne: 'INCOME' },
        date: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } },
  ]);
  const byCategory = expenseAgg.map((r) => ({ category: r._id || 'Uncategorized', total: r.total }));
  const stockPurchases = byCategory.filter((c) => c.category === 'Inventory').reduce((s, c) => s + c.total, 0);
  const otherExpenses = byCategory.filter((c) => c.category !== 'Inventory').reduce((s, c) => s + c.total, 0);
  // A category filter narrows the money-out headline but leaves byCategory intact for the chips.
  const moneyOut = category && category !== 'all'
    ? byCategory.filter((c) => c.category === category).reduce((s, c) => s + c.total, 0)
    : stockPurchases + otherExpenses;

  // Udhaar — outstanding on completed orders left unpaid or partly paid this month.
  const udhaarAgg = await Order.aggregate([
    {
      $match: {
        ...orderLocMatch,
        ...ownerMatch,
        status: 'COMPLETED',
        paymentStatus: { $in: ['unpaid', 'partial'] },
        createdAt: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: null,
        outstanding: {
          $sum: {
            $max: [{ $subtract: [{ $ifNull: ['$grandTotal', '$totalAmount'] }, { $ifNull: ['$amountPaid', 0] }] }, 0],
          },
        },
      },
    },
  ]);
  const udhaar = udhaarAgg[0]?.outstanding || 0;

  res.json({
    success: true,
    data: {
      month: `${year}-${String(mon + 1).padStart(2, '0')}`,
      moneyIn,
      moneyOut,
      stockPurchases,
      otherExpenses,
      byCategory,
      udhaar,
      netCashFlow: moneyIn - moneyOut,
    },
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
  getLocationInfo,
  getStaffReports,
  getStaffReportDetail,
  getPaymentInfo,
  getBranchComparisonSuite,
  getCommandCenterStats,
  getForecastingAnalytics,
  getCashFlow
};
