const mongoose = require('mongoose');
const Location = require('../models/Location');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const BranchInventory = require('../models/BranchInventory');
const WasteRecord = require('../models/WasteRecord');
const asyncHandler = require('../utils/asyncHandler');
const AuditLog = require('../models/AuditLog');

// @desc    Get executive summary for Super Admin
// @route   GET /api/super-admin/executive-summary
const getExecutiveSummary = asyncHandler(async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    branchCount,
    totalRevenueAgg,
    todayRevenueAgg,
    totalProfitAgg,
    branchPerformanceAgg,
    staffPerformanceAgg,
    chefPerformanceAgg,
    paymentMethodAgg,
    couponUsageAgg,
    lowStockCount,
    recentCancellations
  ] = await Promise.all([
    // 1. Total branches
    Location.countDocuments({ isPermanentlyDeleted: false }),

    // 2. Total revenue all time
    Transaction.aggregate([
      { $match: { type: { $ne: 'expense' }, status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),

    // 3. Revenue today
    Transaction.aggregate([
      { $match: { type: { $ne: 'expense' }, status: 'approved', date: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),

    // 4. Net profit estimate
    Transaction.aggregate([
      { $match: { type: { $ne: 'expense' }, status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$totalProfit' } } }
    ]),

    // 5. Branch Performance (Best/Worst)
    Transaction.aggregate([
      { $match: { type: { $ne: 'expense' }, status: 'approved' } },
      { $group: { _id: '$locationId', revenue: { $sum: '$totalAmount' } } },
      { $lookup: { from: 'locations', localField: '_id', foreignField: '_id', as: 'branch' } },
      { $unwind: '$branch' },
      { $project: { name: '$branch.name', revenue: 1 } },
      { $sort: { revenue: -1 } }
    ]),

    // 6. Top Staff
    Order.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: '$createdBy', orderCount: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', orderCount: 1 } },
      { $sort: { orderCount: -1 } },
      { $limit: 5 }
    ]),

    // 7. Top Chef
    Order.aggregate([
      { $match: { status: 'COMPLETED', assignedChef: { $exists: true } } },
      { $group: { _id: '$assignedChef', orderCount: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', orderCount: 1 } },
      { $sort: { orderCount: -1 } },
      { $limit: 5 }
    ]),

    // 8. Payment Method Distribution
    Transaction.aggregate([
      { $match: { type: { $ne: 'expense' }, status: 'approved' } },
      { $group: { _id: { branchId: '$locationId', method: '$paymentMethod' }, total: { $sum: '$totalAmount' } } },
      { $lookup: { from: 'locations', localField: '_id.branchId', foreignField: '_id', as: 'branch' } },
      { $unwind: '$branch' },
      { $project: { branchName: '$branch.name', method: '$_id.method', total: 1 } }
    ]),

    // 9. Coupon Usage per Branch
    Order.aggregate([
      { $match: { status: 'COMPLETED', coupon: { $exists: true } } },
      { $group: { _id: '$branch', count: { $sum: 1 } } },
      { $lookup: { from: 'locations', localField: '_id', foreignField: '_id', as: 'branch' } },
      { $unwind: '$branch' },
      { $project: { name: '$branch.name', count: 1 } },
      { $sort: { count: -1 } }
    ]),

    // 10. Risk Alerts: Low Stock
    BranchInventory.countDocuments({ $expr: { $lte: ['$stock', '$minThreshold'] } }),

    // 11. Risk Alerts: Cancellations (Last 24h)
    Order.countDocuments({ 
      status: 'CANCELLED', 
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
    })
  ]);

  // UPI Leader Branch
  const upiLeaders = paymentMethodAgg.filter(p => p.method === 'UPI').sort((a, b) => b.total - a.total);

  res.json({
    success: true,
    data: {
      totalBranches: branchCount,
      totalRevenue: totalRevenueAgg[0]?.total || 0,
      todayRevenue: todayRevenueAgg[0]?.total || 0,
      netProfit: totalProfitAgg[0]?.total || 0,
      branchRanking: branchPerformanceAgg,
      bestBranch: branchPerformanceAgg[0] || null,
      worstBranch: branchPerformanceAgg[branchPerformanceAgg.length - 1] || null,
      topStaff: staffPerformanceAgg,
      topChefs: chefPerformanceAgg,
      upiLeader: upiLeaders[0] || null,
      highestCouponBranch: couponUsageAgg[0] || null,
      alerts: {
        lowStockItems: lowStockCount,
        recentCancellations
      }
    }
  });
});

// @desc    Get security audit logs
// @route   GET /api/super-admin/audit-logs
const getAuditLogs = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.actionType) query.actionType = req.query.actionType;
  if (req.query.userId) query.user = req.query.userId;
  if (req.query.startDate || req.query.endDate) {
    query.createdAt = {};
    if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
  }

  const logs = await AuditLog.find(query)
    .populate('user', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await AuditLog.countDocuments(query);

  res.json({
    success: true,
    count: logs.length,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
    data: logs
  });
});

module.exports = {
  getExecutiveSummary,
  getAuditLogs
};
