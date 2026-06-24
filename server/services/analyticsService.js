const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Payroll = require('../models/Payroll');
const Table = require('../models/Table');
const Location = require('../models/Location');
const User = require('../models/User');
const Order = require('../models/Order');
const Attendance = require('../models/Attendance');

/**
 * Analytics Service
 * Handles complex data aggregations and business logic for reporting.
 */
class AnalyticsService {
  /**
   * Returns the start-of-day Date (UTC instant) for "today" in Asia/Kolkata (IST, UTC+5:30),
   * so day-based reports bucket on the business calendar rather than the server timezone.
   */
  istStartOfToday() {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(Date.now() + IST_OFFSET_MS);
    // Midnight IST for the current IST calendar day, expressed as a UTC instant.
    const istMidnightUtcMs = Date.UTC(
      nowIst.getUTCFullYear(),
      nowIst.getUTCMonth(),
      nowIst.getUTCDate()
    ) - IST_OFFSET_MS;
    return new Date(istMidnightUtcMs);
  }

  /**
   * Helper to get match criteria based on time filters
   */
  getDateMatchCriteria(startDate, endDate, period, field = 'createdAt') {
    const match = {};
    if (period && period !== 'all') {
      if (period === 'today') {
        match[field] = { $gte: this.istStartOfToday() };
      } else {
        let days;
        if (period === 'week' || period === '7d') days = 7;
        else if (period === 'month' || period === '30d') days = 30;
        else if (period === 'year') days = 365;
        else days = parseInt(period);

        if (!isNaN(days)) {
          match[field] = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
        }
      }
    } else if (startDate || endDate) {
      match[field] = {};
      if (startDate) match[field].$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match[field].$lte = end;
      }
    }
    return match;
  }

  /**
   * Get basic location metrics
   */
  async getLocationMetrics(targetLocation, startDate, endDate) {
    const dateMatch = this.getDateMatchCriteria(startDate, endDate, null, 'date');
    const targetObjectId = new mongoose.Types.ObjectId(targetLocation);

    const [revenueAgg, expenseAgg, payrollAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { locationId: targetObjectId, type: { $in: ['REVENUE', 'POS_REVENUE', 'MANUAL_REVENUE'] }, ...dateMatch, status: 'approved' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
      ]),
      Transaction.aggregate([
        { $match: { locationId: targetObjectId, type: 'EXPENSE', ...dateMatch, status: 'approved' } },
        { $group: { _id: null, totalExpense: { $sum: '$totalAmount' } } }
      ]),
      Payroll.aggregate([
        { $match: { status: 'PAID' } },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'staff' } },
        { $unwind: '$staff' },
        { $match: { 'staff.assignedLocation': targetObjectId } },
        { $group: { _id: null, totalPayroll: { $sum: '$netSalary' } } }
      ])
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalExpense = (expenseAgg[0]?.totalExpense || 0) + (payrollAgg[0]?.totalPayroll || 0);

    return {
      locationId: targetLocation,
      totalRevenue,
      totalExpense,
      profit: totalRevenue - totalExpense
    };
  }

  /**
   * Get global metrics across all locations
   */
  async getGlobalMetrics(matchScope, startDate, endDate, period) {
    const dateMatch = this.getDateMatchCriteria(startDate, endDate, period, 'date');
    const match = { ...dateMatch, ...matchScope };

    const [revenueAgg, expenseAgg, payrollAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: ['REVENUE', 'POS_REVENUE', 'MANUAL_REVENUE'] }, ...match, status: 'approved' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'EXPENSE', ...match, status: 'approved' } },
        { $group: { _id: null, totalExpense: { $sum: '$totalAmount' } } }
      ]),
      Payroll.aggregate([
        { $match: { status: 'PAID' } },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'staff' } },
        { $unwind: '$staff' },
        { $match: (match.locationId ? { 'staff.assignedLocation': match.locationId } : {}) },
        { $group: { _id: null, totalPayroll: { $sum: '$netSalary' } } }
      ])
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalExpense = (expenseAgg[0]?.totalExpense || 0) + (payrollAgg[0]?.totalPayroll || 0);

    return {
      totalRevenue,
      totalExpense,
      profit: totalRevenue - totalExpense
    };
  }

  /**
   * Get advanced time-series and breakdown analytics
   */
  async getAdvancedAnalytics(matchScope, startDate, endDate, adminId, userRole) {
    const match = { ...matchScope };
    if (adminId) {
      try {
        match.createdBy = new mongoose.Types.ObjectId(adminId);
      } catch (e) {
        // A malformed adminId must NOT silently widen scope to all admins.
        // Force an impossible match so the result set is empty.
        match.createdBy = new mongoose.Types.ObjectId('000000000000000000000000');
      }
    }

    const dateMatch = this.getDateMatchCriteria(startDate, endDate, null, 'date');
    const transactionMatch = { ...match, ...dateMatch };

    // Parallel Aggregations
    const [
      transactionAgg,
      manualExpenseAgg,
      payrollAgg,
      personnelStats,
      attendanceAgg,
      paymentAgg,
      upiStats,
      orderStatusAgg,
      forecastAgg
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...transactionMatch, type: { $ne: 'EXPENSE' }, status: 'approved' } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            revenue: { $sum: "$totalAmount" },
            profit: { $sum: "$totalProfit" },
            orders: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } }
      ]),
      Expense.aggregate([
        { $match: { ...match, type: 'EXPENSE', status: { $in: ['approved', 'completed'] }, ...dateMatch } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            expenses: { $sum: "$amount" }
          }
        }
      ]),
      (async () => {
        if (userRole !== 'admin' && userRole !== 'super_admin') return [];
        const payrollPipeline = [
          { $match: { status: 'PAID' } },
          { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'staff' } },
          { $unwind: '$staff' }
        ];
        if (match.locationId) payrollPipeline.push({ $match: { 'staff.assignedLocation': match.locationId } });
        payrollPipeline.push({ $group: { _id: "$month", expenses: { $sum: "$netSalary" } } });
        return Payroll.aggregate(payrollPipeline);
      })(),
      (async () => {
        if (userRole !== 'admin' && userRole !== 'super_admin') return null;
        const userMatch = { role: { $in: ['branch_admin', 'staff', 'chef'] } };
        if (match.locationId) userMatch.assignedLocation = match.locationId;
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
        const stats = personnelAgg[0] || { totalMonthlySalary: 0, staffCount: 0, chefCount: 0, adminCount: 0 };
        stats.avgSalary = stats.staffCount + stats.chefCount + stats.adminCount > 0
          ? stats.totalMonthlySalary / (stats.staffCount + stats.chefCount + stats.adminCount)
          : 0;
        return stats;
      })(),
      Attendance.aggregate([
        // Attendance only supports locationId + date; spreading the full `match`
        // would carry a `createdBy` filter Attendance has no field for, zeroing results.
        { $match: { ...(match.locationId ? { locationId: match.locationId } : {}), ...(dateMatch.date ? { date: { $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] } } : {}) } },
        {
          $group: {
            _id: "$date",
            present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
            halfDay: { $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] } }
          }
        },
        { $sort: { "_id": 1 } },
        { $limit: 30 }
      ]),
      Transaction.aggregate([
        { $match: { ...transactionMatch, type: { $ne: 'EXPENSE' }, status: 'approved' } },
        { $group: { _id: "$source", count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } }
      ]),
      Transaction.aggregate([
        { $match: { ...transactionMatch, type: { $ne: 'EXPENSE' }, status: 'approved' } },
        {
          $group: {
            _id: null,
            upiCount: { $sum: { $cond: [{ $or: [{ $eq: ["$paymentType", "UPI"] }, { $regexMatch: { input: { $ifNull: ["$description", ""] }, regex: "UPI", options: "i" } }] }, 1, 0] } },
            cashCount: { $sum: { $cond: [{ $or: [{ $eq: ["$paymentType", "CASH"] }, { $regexMatch: { input: { $ifNull: ["$description", ""] }, regex: "CASH", options: "i" } }] }, 1, 0] } },
            total: { $sum: 1 }
          }
        },
        { $addFields: { otherCount: { $max: [0, { $subtract: ["$total", { $add: ["$upiCount", "$cashCount"] }] }] } } },
        { $project: { upiCount: { $ifNull: ["$upiCount", 0] }, cashCount: { $ifNull: ["$cashCount", 0] }, otherCount: { $ifNull: ["$otherCount", 0] } } }
      ]),
      Order.aggregate([
        { $match: { ...(match.locationId ? { branch: match.locationId } : {}), createdAt: { $gte: new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } }
      ]),
      (async () => {
        const forecastStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        return Order.aggregate([
          { $match: { ...(match.locationId ? { branch: match.locationId } : {}), status: { $in: ['SERVED', 'COMPLETED'] }, createdAt: { $gte: forecastStartDate } } },
          { $group: { _id: { $dayOfWeek: '$createdAt' }, totalSales: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
        ]);
      })()
    ]);

    // Processing Results
    const allExpenseDates = [...manualExpenseAgg.map(m => m._id), ...payrollAgg.map(p => `${p._id}-01`)];
    const dates = Array.from(new Set([...transactionAgg.map(t => t._id), ...allExpenseDates])).filter(d => d && typeof d === 'string').sort();

    const timeSeries = dates.map(date => {
      const t = transactionAgg.find(item => item._id === date) || { revenue: 0, profit: 0, orders: 0 };
      // Expenses are sourced from the Expense collection only (Transaction EXPENSE rows
      // are mirrors of these and would double-count if added again).
      const e = manualExpenseAgg.find(item => item._id === date)?.expenses || 0;
      const monthStr = date.substring(0, 7);
      const p = date.endsWith('-01') ? (payrollAgg.find(item => item._id === monthStr)?.expenses || 0) : 0;
      return { date, revenue: t.revenue, profit: t.profit, expenses: e + p, orders: t.orders };
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const nextMonthSalesTrend = dayNames.map((name, i) => {
      const entry = forecastAgg.find(f => f._id === i + 1);
      const avg = entry ? entry.totalSales / Math.max(entry.count, 1) : 0;
      return { day: name, projected: Math.round(avg * 1.05) };
    });

    const todayDow = new Date().getDay() + 1;
    const todayEntry = forecastAgg.find(f => f._id === todayDow);
    const expectedTodayRevenue = todayEntry ? Math.round(todayEntry.totalSales / Math.max(todayEntry.count, 1)) : 0;

    const totalRevenue = transactionAgg.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalExpenses = manualExpenseAgg.reduce((acc, curr) => acc + curr.expenses, 0) + payrollAgg.reduce((acc, curr) => acc + curr.expenses, 0);
    const totalOrders = transactionAgg.reduce((acc, curr) => acc + curr.orders, 0);

    const [staffAgg, categoryAgg, recentExpenses, recentRevenues] = await Promise.all([
      Transaction.aggregate([
        { $match: transactionMatch },
        { $lookup: { from: 'users', localField: 'staffId', foreignField: '_id', as: 'staff' } },
        { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'creator' } },
        { $addFields: { effectiveStaff: { $ifNull: [{ $arrayElemAt: ['$staff', 0] }, { $arrayElemAt: ['$creator', 0] }] } } },
        { $group: { _id: { $ifNull: ['$effectiveStaff.name', 'Standard Staff'] }, revenue: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } },
        { $sort: { revenue: -1 } }
      ]),
      Transaction.aggregate([
        { $match: transactionMatch },
        { $facet: {
          byItems: [
            { $unwind: '$orders' },
            { $lookup: { from: 'menuitems', localField: 'orders.menuItemId', foreignField: '_id', as: 'menuItem' } },
            { $addFields: { item: { $arrayElemAt: ['$menuItem', 0] } } },
            { $lookup: { from: 'categories', localField: 'item.category', foreignField: '_id', as: 'categoryData' } },
            { $addFields: { cat: { $arrayElemAt: ['$categoryData', 0] } } },
            { $group: { _id: { $ifNull: ['$cat.name', 'General'] }, value: { $sum: { $multiply: ['$orders.price', '$orders.quantity'] } }, count: { $sum: '$orders.quantity' } } }
          ],
          byTransaction: [
            { $group: { _id: { $ifNull: ['$category', 'Other'] }, value: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
          ]
        }},
        { $project: { combined: { $concatArrays: ['$byItems', '$byTransaction'] } } },
        { $unwind: '$combined' },
        { $group: { _id: '$combined._id', value: { $sum: '$combined.value' }, count: { $sum: '$combined.count' } } },
        { $sort: { value: -1 } },
        { $limit: 10 }
      ]),
      Transaction.find({ ...transactionMatch, type: 'EXPENSE', status: 'approved' }).sort({ date: -1, createdAt: -1 }).limit(5).populate('locationId', 'name city').populate('createdBy', 'name').lean(),
      Transaction.find({ ...transactionMatch, type: { $ne: 'EXPENSE' } }).sort({ date: -1, createdAt: -1 }).limit(5).populate('locationId', 'name city').populate('staffId', 'name').populate('createdBy', 'name').lean()
    ]);

    return {
      timeSeries,
      categorySales: categoryAgg.map(c => ({ name: c._id, value: c.value, count: c.count })),
      staffPerformance: staffAgg.map(s => ({ name: s._id, revenue: s.revenue, totalOrders: s.totalOrders })),
      recentExpenses,
      recentRevenues,
      staffStats: personnelStats,
      attendanceStats: attendanceAgg,
      paymentStats: { methods: upiStats[0] || { upiCount: 0, cashCount: 0 }, sources: paymentAgg },
      orderStats: orderStatusAgg,
      forecast: { expectedTodayRevenue, nextMonthSalesTrend },
      summary: {
        totalRevenue,
        totalExpenses,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        netProfit: totalRevenue - totalExpenses,
        cancellationRate: orderStatusAgg.find(o => o._id === 'CANCELLED')?.count || 0
      }
    };
  }

  /**
   * Get trending items with growth analysis
   */
  async getTrendingItems(matchScope, period, startDate, endDate) {
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

    const [currentSales, previousSales] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...matchScope, date: { $gte: currentPeriodStart, $lte: currentPeriodEnd } } },
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
      ]),
      Transaction.aggregate([
        { $match: { ...matchScope, date: { $gte: previousPeriodStart, $lt: currentPeriodStart } } },
        { $unwind: "$orders" },
        { $group: { _id: "$orders.menuItemId", previousQty: { $sum: "$orders.quantity" } } }
      ])
    ]);

    return currentSales.map(curr => {
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
  }

  /**
   * Get performance metrics for each location to identify outliers
   */
  async getLocationOutliers(ids, startDate, endDate, period) {
    const dateMatch = this.getDateMatchCriteria(startDate, endDate, period, 'date');
    const match = { locationId: { $in: ids }, ...dateMatch };

    const [transactionAgg, expenseAgg, locations] = await Promise.all([
      Transaction.aggregate([
        { $match: match },
        { $group: { _id: "$locationId", revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 }, profit: { $sum: "$totalProfit" }, avgOrderValue: { $avg: "$totalAmount" } } }
      ]),
      Expense.aggregate([
        { $match: { locationId: { $in: ids }, type: 'EXPENSE', ...(dateMatch.date ? { date: dateMatch.date } : {}) } },
        { $group: { _id: "$locationId", totalExpense: { $sum: "$amount" } } }
      ]),
      Location.find({ _id: { $in: ids } }, 'name city')
    ]);

    return locations.map(loc => {
      const trans = transactionAgg.find(t => t._id.toString() === loc._id.toString()) || { revenue: 0, orders: 0, profit: 0, avgOrderValue: 0 };
      const exp = expenseAgg.find(e => e._id.toString() === loc._id.toString()) || { totalExpense: 0 };
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
  }

  /**
   * Get real-time command center dashboard stats
   */
  async getLiveStats(branchScope) {
    const orderFilter = branchScope ? { branch: branchScope } : {};
    const tableFilter = branchScope ? { locationId: branchScope } : {};
    const todayStart = this.istStartOfToday();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const [
      ordersIncomingNow,
      kitchenBusyLevel,
      tablesOccupied,
      activeStaffOnline,
      revenueTodayLive,
      pendingOrdersOver10Min
    ] = await Promise.all([
      Order.countDocuments({ ...orderFilter, status: 'PLACED' }),
      Order.countDocuments({ ...orderFilter, status: 'PREPARING' }),
      Table.countDocuments({ ...tableFilter, status: { $in: ['occupied', 'ongoing'] } }),
      User.countDocuments({ ...(orderFilter.branch ? { assignedLocation: orderFilter.branch } : {}), role: { $in: ['staff', 'chef'] }, isBlocked: false }),
      Order.aggregate([
        { $match: { ...orderFilter, status: { $in: ['SERVED', 'COMPLETED'] }, createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Order.countDocuments({ ...orderFilter, status: 'PLACED', createdAt: { $lt: tenMinutesAgo } })
    ]);

    let healthScore = 100 - (pendingOrdersOver10Min * 5);
    if (kitchenBusyLevel > 15) healthScore -= 15;

    return {
      ordersIncomingNow,
      kitchenBusyLevel,
      tablesOccupied,
      activeStaffOnline,
      revenueTodayLive: revenueTodayLive[0]?.total || 0,
      pendingOrdersOver10Min,
      branchHealthScore: Math.max(0, Math.min(healthScore, 100)),
      timestamp: new Date()
    };
  }
}

module.exports = new AnalyticsService();
