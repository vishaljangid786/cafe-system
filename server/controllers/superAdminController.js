const User = require('../models/User');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Location = require('../models/Location');
const Cafe = require('../models/Cafe');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');

// @desc    Get executive summary for super admin dashboard
// @route   GET /api/super-admin/executive-summary
// @access  Private (Super Admin)
const getExecutiveSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate, cafeId } = req.query;

  // ---- Optional scope filters (date range + cafe) so the dashboard is drillable ----
  const dateMatch = {};
  if (startDate) dateMatch.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateMatch.$lte = end;
  }
  const hasDate = Object.keys(dateMatch).length > 0;

  // A cafe filter resolves to the set of branches owned by that cafe.
  let branchIds = null;
  if (cafeId && mongoose.isValidObjectId(cafeId)) {
    const branches = await Location.find({ cafe: cafeId }).select('_id').lean();
    branchIds = branches.map((b) => b._id);
  }
  const branchScope = branchIds ? { branch: { $in: branchIds } } : {};

  // Base match reused across order aggregations.
  const baseMatch = { ...branchScope };
  if (hasDate) baseMatch.createdAt = dateMatch;
  const completedMatch = { ...baseMatch, status: 'COMPLETED' };

  // ---- 1. Core revenue metrics ----
  const [revenueAgg] = await Order.aggregate([
    { $match: completedMatch },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
        tax: { $sum: '$taxAmount' },
        discount: { $sum: '$discountAmount' },
      },
    },
  ]);
  const totalRevenue = revenueAgg?.total || 0;
  const completedOrders = revenueAgg?.orders || 0;
  const totalTax = revenueAgg?.tax || 0;
  const totalDiscount = revenueAgg?.discount || 0;
  const avgOrderValue = completedOrders ? totalRevenue / completedOrders : 0;
  // Approximate net profit (revenue - costs, simplified for demo)
  const netProfit = totalRevenue * 0.4;

  // Today's numbers are always "today" regardless of the selected range.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayAgg] = await Order.aggregate([
    { $match: { ...branchScope, status: 'COMPLETED', createdAt: { $gte: today } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
  ]);
  const todayRevenue = todayAgg?.total || 0;
  const todayOrders = todayAgg?.orders || 0;

  // ---- 2. Entity counts ----
  const [totalBranches, totalCafes, totalCustomers, totalMenuItems, totalStaff, pendingApprovals, totalOrders] =
    await Promise.all([
      Location.countDocuments(branchIds ? { _id: { $in: branchIds } } : {}),
      Cafe.countDocuments(),
      Customer.countDocuments(),
      MenuItem.countDocuments(),
      User.countDocuments({ role: { $in: ['staff', 'chef'] } }),
      Order.countDocuments({ ...baseMatch, 'paymentApproval.status': 'pending' }),
      Order.countDocuments(baseMatch),
    ]);

  // ---- 3. Branch ranking (top 5 by revenue) ----
  const branchRanking = await Order.aggregate([
    { $match: completedMatch },
    { $group: { _id: '$branch', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'locations', localField: '_id', foreignField: '_id', as: 'loc' } },
    { $unwind: '$loc' },
    { $project: { name: '$loc.name', city: '$loc.city', revenue: 1, orders: 1 } },
  ]);

  // ---- 4. Payment split (cash / UPI / card / …) ----
  const paymentSplit = await Order.aggregate([
    { $match: completedMatch },
    { $group: { _id: '$paymentType', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $project: { _id: 0, type: '$_id', total: 1, count: 1 } },
  ]);

  // ---- 5. Top UPI branch (fills a widget the UI already expects) ----
  const [upiLeader] = await Order.aggregate([
    { $match: { ...completedMatch, paymentType: 'UPI' } },
    { $group: { _id: '$branch', total: { $sum: '$totalAmount' } } },
    { $sort: { total: -1 } },
    { $limit: 1 },
    { $lookup: { from: 'locations', localField: '_id', foreignField: '_id', as: 'loc' } },
    { $unwind: '$loc' },
    { $project: { _id: 0, branchName: '$loc.name', total: 1 } },
  ]);

  // ---- 6. Highest coupon-using branch ----
  const [highestCouponBranch] = await Order.aggregate([
    { $match: { ...baseMatch, coupon: { $ne: null } } },
    { $group: { _id: '$branch', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
    { $lookup: { from: 'locations', localField: '_id', foreignField: '_id', as: 'loc' } },
    { $unwind: '$loc' },
    { $project: { _id: 0, name: '$loc.name', count: 1 } },
  ]);

  // ---- 7. Top performers (top 3 chefs & staff) ----
  const topChefs = await Order.aggregate([
    { $match: { ...baseMatch, assignedChef: { $ne: null } } },
    { $group: { _id: '$assignedChef', orderCount: { $sum: 1 } } },
    { $sort: { orderCount: -1 } },
    { $limit: 3 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $project: { name: '$u.name', orderCount: 1 } },
  ]);
  const topStaff = await Order.aggregate([
    { $match: { ...baseMatch, createdBy: { $ne: null } } },
    { $group: { _id: '$createdBy', orderCount: { $sum: 1 } } },
    { $sort: { orderCount: -1 } },
    { $limit: 3 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $project: { name: '$u.name', orderCount: 1 } },
  ]);

  // ---- 8. Best-selling menu items ----
  const topMenuItems = await Order.aggregate([
    { $match: completedMatch },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.itemName',
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { quantity: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, name: '$_id', quantity: 1, revenue: 1 } },
  ]);

  // ---- 9. Orders by status ----
  const ordersByStatus = await Order.aggregate([
    { $match: baseMatch },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
  ]);

  // ---- 10. Revenue trend (selected range, or the last 14 days by default) ----
  const trendStart = hasDate && dateMatch.$gte ? new Date(dateMatch.$gte) : new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  trendStart.setHours(0, 0, 0, 0);
  const revenueTrend = await Order.aggregate([
    {
      $match: {
        ...branchScope,
        status: 'COMPLETED',
        createdAt: { $gte: trendStart, ...(dateMatch.$lte ? { $lte: dateMatch.$lte } : {}) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', revenue: 1, orders: 1 } },
  ]);

  // ---- 11. Alerts & anomalies ----
  const lowStockCount = await MenuItem.countDocuments({ status: 'Out of Stock' });
  const recentCancellations = await Order.countDocuments({
    ...branchScope,
    status: 'CANCELLED',
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  res.json({
    success: true,
    data: {
      // core
      totalRevenue,
      todayRevenue,
      todayOrders,
      totalBranches,
      netProfit,
      completedOrders,
      totalOrders,
      avgOrderValue,
      totalTax,
      totalDiscount,
      // entities
      totalCafes,
      totalCustomers,
      totalMenuItems,
      totalStaff,
      pendingApprovals,
      // breakdowns
      branchRanking,
      paymentSplit,
      upiLeader: upiLeader || null,
      highestCouponBranch: highestCouponBranch || null,
      topChefs,
      topStaff,
      topMenuItems,
      ordersByStatus,
      revenueTrend,
      alerts: {
        lowStockItems: lowStockCount,
        recentCancellations,
      },
    },
  });
});

// @desc    Get paginated audit logs
// @route   GET /api/super-admin/audit-logs
// @access  Private (Super Admin)
const getAuditLogs = asyncHandler(async (req, res) => {
  const { escapeRegex, clampLimit, scopedLocationId } = require('../utils/accessControl');
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const pageNum = parseInt(page);
  const limitNum = clampLimit(limit, 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  
  const branch = scopedLocationId(req, req.query.locationId);
  if (branch) query.locationId = branch;

  if (req.query.actionType) query.action = req.query.actionType;
  if (req.query.userId) query.performedBy = req.query.userId;
  if (req.query.role) query.role = req.query.role;

  // Date Range
  if (req.query.startDate || req.query.endDate) {
    query.createdAt = {};
    if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
  }

  // Text Search in details
  if (req.query.search) {
    query.details = { $regex: escapeRegex(req.query.search), $options: 'i' };
  }

  const logs = await AuditLog.find(query)
    .populate('performedBy', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await AuditLog.countDocuments(query);

  res.json({
    success: true,
    data: logs,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limitNum)
    }
  });
});

module.exports = {
  getExecutiveSummary,
  getAuditLogs
};
