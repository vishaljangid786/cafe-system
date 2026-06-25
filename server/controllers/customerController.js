const Customer = require('../models/Customer');
const Location = require('../models/Location');
const asyncHandler = require('../utils/asyncHandler');
const { scopedLocationId, isAllLocation } = require('../utils/accessControl');

// Build a Customer query filter scoped to the caller's accessible branches AND the
// optional top-navbar cafe/branch selector. Customers carry a `branch`; super_admin
// sees all, others only their accessible branches. A specific branch (locationId)
// wins; otherwise a selected cafe scopes to that cafe's branches (intersected with
// the caller's scope). Async because the cafe→branches lookup hits the DB.
const buildBranchFilter = async (req) => {
  const { locationId, cafeId } = req.query;
  const branchScope = scopedLocationId(req, locationId); // single id | { $in } | null

  if (locationId && !isAllLocation(locationId)) {
    return branchScope ? { branch: branchScope } : {};
  }

  if (cafeId && !isAllLocation(cafeId)) {
    const cafeBranches = await Location.find({ cafe: cafeId, isPermanentlyDeleted: { $ne: true } })
      .select('_id').lean();
    let ids = cafeBranches.map((b) => b._id.toString());
    if (branchScope && typeof branchScope === 'object' && Array.isArray(branchScope.$in)) {
      const allowed = new Set(branchScope.$in.map(String));
      ids = ids.filter((id) => allowed.has(id)); // intersect with the caller's {$in} scope
    } else if (branchScope) {
      // Scalar branch (the location_admin/staff fallback returns a bare id): keep it
      // only if it belongs to the cafe, so the cafe filter can never WIDEN a
      // single-branch user's scope to every branch in the cafe.
      ids = ids.includes(String(branchScope)) ? [String(branchScope)] : [];
    }
    return { branch: { $in: ids } };
  }

  return branchScope ? { branch: branchScope } : {};
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

  const query = await buildBranchFilter(req);

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
  const customers = await Customer.find(await buildBranchFilter(req))
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
    ...(await buildBranchFilter(req)),
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
  const branchFilter = await buildBranchFilter(req);

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
