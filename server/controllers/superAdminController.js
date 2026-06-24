const User = require('../models/User');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Location = require('../models/Location');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');

// @desc    Get executive summary for super admin dashboard
// @route   GET /api/super-admin/executive-summary
// @access  Private (Super Admin)
const getExecutiveSummary = asyncHandler(async (req, res) => {
  // Data isolation: this endpoint is reachable via the delegable `viewAdminCenter`
  // permission, so a non-super-admin must only ever see THEIR accessible branches'
  // financials — never the whole platform. super_admin sees everything (empty scope).
  const { userLocationIds } = require('../utils/accessControl');
  const isSuper = req.user.role === 'super_admin';
  const branchIds = isSuper ? null : (userLocationIds(req.user) || []);
  const scope = isSuper ? {} : { branch: { $in: branchIds } };

  // 1. Core Metrics
  const totalRevenueData = await Order.aggregate([
    { $match: { ...scope, status: 'COMPLETED' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  const totalRevenue = totalRevenueData[0]?.total || 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRevenueData = await Order.aggregate([
    { $match: { ...scope, status: 'COMPLETED', createdAt: { $gte: today } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  const todayRevenue = todayRevenueData[0]?.total || 0;

  const totalBranches = isSuper
    ? await Location.countDocuments()
    : (branchIds ? branchIds.length : 0);
  
  // Approximate net profit (revenue - costs, simplified for demo)
  const netProfit = totalRevenue * 0.4; 

  // 2. Branch Ranking
  const branchRanking = await Order.aggregate([
    { $match: { ...scope, status: 'COMPLETED' } },
    {
      $group: {
        _id: '$branch',
        revenue: { $sum: '$totalAmount' }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'locations',
        localField: '_id',
        foreignField: '_id',
        as: 'locationDetails'
      }
    },
    { $unwind: '$locationDetails' },
    {
      $project: {
        name: '$locationDetails.name',
        revenue: 1
      }
    }
  ]);

  // 3. Top Performers
  const topChefs = await Order.aggregate([
    { $match: scope },
    { $group: { _id: '$assignedChef', orderCount: { $sum: 1 } } },
    { $sort: { orderCount: -1 } },
    { $limit: 1 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userDetails' } },
    { $unwind: '$userDetails' },
    { $project: { name: '$userDetails.name', orderCount: 1 } }
  ]);

  const topStaff = await Order.aggregate([
    { $match: scope },
    { $group: { _id: '$createdBy', orderCount: { $sum: 1 } } },
    { $sort: { orderCount: -1 } },
    { $limit: 1 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userDetails' } },
    { $unwind: '$userDetails' },
    { $project: { name: '$userDetails.name', orderCount: 1 } }
  ]);

  // 4. Alerts & Anomalies (branch-scoped for non-super-admins)
  const lowStockCount = await MenuItem.countDocuments(isSuper ? {} : { availableBranches: { $in: branchIds } });
  const recentCancellations = await Order.countDocuments({
    ...scope,
    status: 'CANCELLED',
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  res.json({
    success: true,
    data: {
      totalRevenue,
      todayRevenue,
      totalBranches,
      netProfit,
      branchRanking,
      topChefs,
      topStaff,
      alerts: {
        lowStockItems: lowStockCount,
        recentCancellations
      }
    }
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
