const mongoose = require('mongoose');
const Table = require('../models/Table');
const Expense = require('../models/Expense');
const Location = require('../models/Location');
const asyncHandler = require('../utils/asyncHandler');

// Helper to get match criteria based on time filters
const getDateMatchCriteria = (startDate, endDate) => {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  return match;
};

// @desc    Get analytics for a specific location
// @route   GET /api/analytics/location
// @access  Private
const getLocationAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, locationId } = req.query;
  const targetLocation = req.user.role === 'location_admin' ? req.user.assignedLocation : locationId;

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
  const { startDate, endDate, locationId } = req.query;
  const matchCriteria = { type: 'income' };
  
  if (locationId) {
    matchCriteria.locationId = new mongoose.Types.ObjectId(locationId);
  } else if (req.user.role === 'location_admin') {
    matchCriteria.locationId = new mongoose.Types.ObjectId(req.user.assignedLocation);
  }

  const dateMatch = getDateMatchCriteria(startDate, endDate);
  // Expense uses 'date' field instead of 'createdAt' for fiscal records
  if (dateMatch.createdAt) {
    matchCriteria.date = dateMatch.createdAt;
  }

  // 1. Revenue & Orders Over Time (Daily) from Expenses
  const timeSeriesAgg = await Expense.aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        revenue: { $sum: "$amount" },
        orders: { $sum: 1 }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  // 2. Summary Stats from Expenses
  const summaryAgg = await Expense.aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: "$amount" }
      }
    }
  ]);

  // 3. Staff Performance from Expenses
  const staffAgg = await Expense.aggregate([
    { $match: matchCriteria },
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "staff"
      }
    },
    { $unwind: "$staff" },
    {
      $group: {
        _id: "$staff.name",
        totalRevenue: { $sum: "$amount" },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  // 4. Category Sales (This still needs Table/MenuItem data, but we can try to fetch from recent completed tables or a better way)
  // For now, let's keep it from Table but we should really have an Order model for this.
  // Given the current architecture, I'll fall back to Table for category sales but revenue is now from Expense.
  const tableMatch = { status: 'available', totalAmount: 0 }; // This is wrong because completed tables are available
  // Wait, if tables are reset, we can't get category sales from them easily unless we store it elsewhere.
  // I will use a dummy/empty array for now to prevent crash, and we'll fix table completion to store this.
  
  res.json({
    success: true,
    data: {
      timeSeries: timeSeriesAgg.map(t => ({ date: t._id, revenue: t.revenue, orders: t.orders })),
      categorySales: [], // To be fixed by adding breakdown to Expense
      staffPerformance: staffAgg.map(s => ({ name: s._id, revenue: s.totalRevenue, orders: s.totalOrders })),
      summary: summaryAgg[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 }
    }
  });
});

const Transaction = require('../models/Transaction');

// @desc    Compare multiple locations across key metrics
// @route   GET /api/analytics/location-comparison
const getLocationComparison = asyncHandler(async (req, res) => {
  const { locationIds, startDate, endDate, period } = req.query;
  const ids = locationIds ? locationIds.split(',').map(id => new mongoose.Types.ObjectId(id)) : [];
  
  const dateMatch = {};
  if (period) {
    const days = parseInt(period);
    dateMatch.date = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  } else if (startDate || endDate) {
    dateMatch.date = {};
    if (startDate) dateMatch.date.$gte = new Date(startDate);
    if (endDate) dateMatch.date.$lte = new Date(endDate);
  }

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
  const { startDate, endDate, period } = req.query;
  const dateMatch = {};
  if (period) {
    const days = parseInt(period);
    dateMatch.date = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  } else if (startDate || endDate) {
    dateMatch.date = {};
    if (startDate) dateMatch.date.$gte = new Date(startDate);
    if (endDate) dateMatch.date.$lte = new Date(endDate);
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
  const { locationId, period = 7 } = req.query; // period in days
  const now = new Date();
  const currentPeriodStart = new Date(now.setDate(now.getDate() - period));
  const previousPeriodStart = new Date(new Date(currentPeriodStart).setDate(currentPeriodStart.getDate() - period));

  const matchCriteria = locationId ? { locationId: new mongoose.Types.ObjectId(locationId) } : {};

  // Current Period Sales
  const currentSales = await Transaction.aggregate([
    { $match: { ...matchCriteria, date: { $gte: currentPeriodStart } } },
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
  const transactionAgg = await Transaction.aggregate([
    { $match: { date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }, // Last 30 days
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

module.exports = {
  getLocationAnalytics,
  getAllAnalytics,
  compareLocations,
  getAdvancedAnalytics,
  getLocationComparison,
  getTopLocations,
  getTrendingItems,
  getUnderperformingLocations,
  getProductPerformance
};
