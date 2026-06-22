const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const { scopedLocationId } = require('../utils/accessControl');

// Build a Customer query filter scoped to the current user's accessible branches.
// Customers are tied to a `branch` field; super_admin sees all, admin sees their
// accessibleLocations, branch_admin/staff see only their assignedLocation.
const buildBranchFilter = (req) => {
  const branch = scopedLocationId(req, req.query.locationId);
  return branch ? { branch } : {};
};

// @desc    Get all customers with pagination & search
// @route   GET /api/customers
// @access  Private/Admin
const getCustomers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '', sort = '-totalSpend' } = req.query;

  const { escapeRegex, clampLimit } = require('../utils/accessControl');
  const pageNum = parseInt(page);
  const limitNum = clampLimit(limit, 50);
  const skip = (pageNum - 1) * limitNum;

  // Only allow sorting by known fields (user-supplied `sort` otherwise reaches Mongoose verbatim).
  const SORTABLE = new Set(['totalSpend', 'visits', 'orderCount', 'name', 'createdAt', 'lastVisit', 'loyaltyPoints']);
  const safeSort = SORTABLE.has(String(sort).replace(/^-/, '')) ? sort : '-totalSpend';

  const query = buildBranchFilter(req);

  if (search) {
    const cleanSearch = escapeRegex(search);
    query.$or = [
      { name: { $regex: cleanSearch, $options: 'i' } },
      { phone: { $regex: cleanSearch, $options: 'i' } }
    ];
  }

  const total = await Customer.countDocuments(query);
  const customers = await Customer.find(query)
    .sort(safeSort)
    .skip(skip)
    .limit(limitNum)
    .lean();

  res.json({
    success: true,
    count: customers.length,
    total,
    pages: Math.ceil(total / limitNum),
    page: pageNum,
    data: customers
  });
});

// @desc    Get top customers by spend
// @route   GET /api/customers/top
// @access  Private/Admin
const getTopCustomers = asyncHandler(async (req, res) => {
  const customers = await Customer.find(buildBranchFilter(req))
    .sort({ totalSpend: -1 })
    .limit(10)
    .lean();

  res.json({ success: true, data: customers });
});

// @desc    Get inactive customers (No visits in last 30 days)
// @route   GET /api/customers/inactive
// @access  Private/Admin
const getInactiveCustomers = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const customers = await Customer.find({
    ...buildBranchFilter(req),
    lastVisit: { $lt: thirtyDaysAgo }
  })
    .sort({ lastVisit: -1 })
    .limit(20)
    .lean();

  res.json({ success: true, count: customers.length, data: customers });
});

// @desc    Get CRM KPI Analytics
// @route   GET /api/customers/analytics
// @access  Private/Admin
const getCustomerAnalytics = asyncHandler(async (req, res) => {
  const branchFilter = buildBranchFilter(req);

  const totalCustomers = await Customer.countDocuments(branchFilter);

  const repeatCustomers = await Customer.countDocuments({ ...branchFilter, visits: { $gt: 1 } });

  const repeatRate = totalCustomers > 0 ? ((repeatCustomers / totalCustomers) * 100).toFixed(1) : 0;

  const totalLoyaltyPoints = await Customer.aggregate([
    ...(Object.keys(branchFilter).length ? [{ $match: branchFilter }] : []),
    { $group: { _id: null, total: { $sum: '$loyaltyPoints' } } }
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const inactiveCustomersCount = await Customer.countDocuments({
    ...branchFilter,
    lastVisit: { $lt: thirtyDaysAgo }
  });

  res.json({
    success: true,
    data: {
      totalCustomers,
      repeatCustomers,
      repeatRate: parseFloat(repeatRate),
      totalRewardPoints: totalLoyaltyPoints.length > 0 ? totalLoyaltyPoints[0].total : 0,
      inactiveCustomersCount
    }
  });
});

module.exports = {
  getCustomers,
  getTopCustomers,
  getInactiveCustomers,
  getCustomerAnalytics
};
