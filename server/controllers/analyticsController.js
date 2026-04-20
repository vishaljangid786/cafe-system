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

module.exports = {
  getLocationAnalytics,
  getAllAnalytics,
  compareLocations,
};
