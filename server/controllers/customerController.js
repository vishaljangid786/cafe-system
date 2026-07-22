const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Location = require('../models/Location');
// Registered so `.populate('memberships.cafe')` works regardless of module load
// order — populate resolves the ref by model NAME, which must already exist.
require('../models/Cafe');
const asyncHandler = require('../utils/asyncHandler');
const { scopedLocationId, isAllLocation } = require('../utils/accessControl');
const { requireRecord, assertCanDelete, announceDeletion } = require('../utils/deleteGuard');

// Build a Customer query filter scoped to the caller's accessible branches AND the
// optional top-navbar cafe/branch selector. super_admin sees all, others only their
// accessible branches. A specific branch (locationId) wins; otherwise a selected
// cafe scopes to that cafe (intersected with the caller's scope). Async because the
// cafe→branches lookup hits the DB.
// Scope customers to the caller's branches/cafe.
//
// Customers are now GLOBAL identities with a `memberships[]` entry per cafe, so
// "belongs to this branch" means "has visited this branch" — i.e. the branch is in
// `memberships.branches` — not the old flat `branch`, which is merely the initial
// acquisition branch. Matching on `branch` here would have silently hidden every
// customer who first joined at another branch of the same cafe.
const branchMatch = (scope) => ({ 'memberships.branches': scope });

const buildBranchFilter = async (req) => {
  const { locationId, cafeId } = req.query;
  const branchScope = scopedLocationId(req, locationId); // single id | { $in } | null

  if (locationId && !isAllLocation(locationId)) {
    return branchScope ? branchMatch(branchScope) : {};
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
    // A caller who asked for a whole cafe and may see all of it is matched on the
    // membership's cafe directly; otherwise fall back to the allowed branch subset.
    const askedWholeCafe = !branchScope;
    return askedWholeCafe
      ? { 'memberships.cafe': new mongoose.Types.ObjectId(String(cafeId)) }
      : branchMatch({ $in: ids.map((id) => new mongoose.Types.ObjectId(id)) });
  }

  return branchScope ? branchMatch(branchScope) : {};
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

// ── CRM report / 360 ─────────────────────────────────────────────────────────

const Order = require('../models/Order');
const { endOfDay, clampLimit, escapeRegex, userLocationIds, canAccessLocation, normalizeId } = require('../utils/accessControl');
const { getSettingsWithSources } = require('../utils/settings');
const { logActivity } = require('../utils/auditLogger');
const { normalizePhone } = require('../utils/phone');

// The branches a caller may see, as ObjectIds. null = unrestricted (super_admin).
const allowedBranchIds = (req) => {
  if (req.user.role === 'super_admin') return null;
  return userLocationIds(req.user).map((id) => new mongoose.Types.ObjectId(String(id)));
};

// Parse the shared YYYY-MM-DD range used by the Overview page.
const parseRange = (startDate, endDate) => {
  const range = {};
  if (startDate) range.$gte = new Date(startDate);
  if (endDate) range.$lte = endOfDay(endDate);
  return Object.keys(range).length ? range : null;
};

// Completed-order match for the caller's scope. Orders key off `branch`.
const orderScopeMatch = async (req) => {
  const { locationId, cafeId } = req.query;
  const allowed = allowedBranchIds(req);
  const match = { status: 'COMPLETED' };

  if (locationId && !isAllLocation(locationId)) {
    if (!canAccessLocation(req.user, locationId)) {
      const err = new Error('Permission denied to this location');
      err.statusCode = 403;
      throw err;
    }
    match.branch = new mongoose.Types.ObjectId(String(locationId));
    return match;
  }
  if (cafeId && !isAllLocation(cafeId)) {
    const branches = await Location.find({ cafe: cafeId, isPermanentlyDeleted: { $ne: true } })
      .select('_id').lean();
    let ids = branches.map((b) => b._id);
    if (allowed) {
      const ok = new Set(allowed.map(String));
      ids = ids.filter((id) => ok.has(String(id)));
    }
    match.branch = { $in: ids };
    return match;
  }
  if (allowed) match.branch = { $in: allowed };
  return match;
};

// @desc    Paginated CRM report + summary
// @route   GET /api/customers/report
const getCustomerReport = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20, search = '', sort = '-totalSpend',
    startDate, endDate, status = 'all', minOrders, hasDob, birthdayMonth, cafeId,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  // Ceiling raised above the on-screen page size so the UI can pull the whole
  // filtered set for an export in one request, instead of silently exporting
  // only the rows currently visible.
  const limitNum = clampLimit(limit, 20, 1000);
  const skip = (pageNum - 1) * limitNum;

  const SORTABLE = new Set(['totalSpend', 'visits', 'name', 'createdAt', 'lastVisit', 'loyaltyPoints']);
  const safeSort = SORTABLE.has(String(sort).replace(/^-/, '')) ? sort : '-totalSpend';

  const query = await buildBranchFilter(req);

  if (search) {
    const clean = escapeRegex(search);
    query.$or = [
      { name: { $regex: clean, $options: 'i' } },
      { phone: { $regex: clean, $options: 'i' } },
    ];
  }
  if (status === 'new' || status === 'existing') {
    // Status is per cafe; when a cafe is selected match that membership exactly,
    // otherwise match "has any membership in this state".
    query.memberships = cafeId && !isAllLocation(cafeId)
      ? { $elemMatch: { cafe: new mongoose.Types.ObjectId(String(cafeId)), status } }
      : { $elemMatch: { status } };
  }
  if (minOrders) query.visits = { $gte: Number(minOrders) || 0 };
  if (String(hasDob) === 'true') query.dob = { $ne: null };
  if (birthdayMonth) query.dobMonth = Number(birthdayMonth);

  const range = parseRange(startDate, endDate);
  if (range) query.createdAt = range;

  const [total, rows] = await Promise.all([
    Customer.countDocuments(query),
    Customer.find(query)
      .sort(safeSort)
      .skip(skip)
      .limit(limitNum)
      .populate('memberships.cafe', 'name')
      .populate('memberships.branches', 'name city')
      .populate('branch', 'name city')
      .lean(),
  ]);

  res.json({
    success: true,
    count: rows.length,
    total,
    pages: Math.ceil(total / limitNum) || 1,
    page: pageNum,
    data: rows,
  });
});

// @desc    KPI block for the CRM page
// @route   GET /api/customers/summary
const getCustomerSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const scope = await buildBranchFilter(req);
  const range = parseRange(startDate, endDate);

  const inRange = range ? { ...scope, createdAt: range } : { ...scope };

  // Orders inside the range, for repeat/returning maths.
  const orderMatch = await orderScopeMatch(req);
  if (range) orderMatch.createdAt = range;

  const [
    totalCustomers, newInRange, withDob, withEmail, atRisk, birthdaysThisMonth, perCustomer,
  ] = await Promise.all([
    Customer.countDocuments(scope),
    Customer.countDocuments(inRange),
    Customer.countDocuments({ ...scope, dob: { $ne: null } }),
    Customer.countDocuments({ ...scope, email: { $ne: null } }),
    Customer.countDocuments({ ...scope, lastVisit: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
    Customer.countDocuments({ ...scope, dobMonth: new Date().getMonth() + 1 }),
    Order.aggregate([
      { $match: orderMatch },
      { $group: { _id: '$customerPhone', orders: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
    ]),
  ]);

  // "Repeat in period" = 2+ completed orders inside the window.
  const repeatInRange = perCustomer.filter((c) => c._id && c.orders >= 2).length;
  // "Returning from earlier" = ordered in the window but first seen before it.
  let returningFromPrevPeriod = 0;
  if (range?.$gte && perCustomer.length) {
    const phones = perCustomer.map((c) => c._id).filter(Boolean);
    returningFromPrevPeriod = await Customer.countDocuments({
      ...scope,
      phone: { $in: phones },
      createdAt: { $lt: range.$gte },
    });
  }

  const orderCount = perCustomer.reduce((a, c) => a + c.orders, 0);
  const orderAmount = perCustomer.reduce((a, c) => a + (c.amount || 0), 0);
  const distinct = perCustomer.filter((c) => c._id).length;

  res.json({
    success: true,
    data: {
      totalCustomers,
      newInRange,
      repeatInRange,
      returningFromPrevPeriod,
      avgOrdersPerCustomer: distinct ? Number((orderCount / distinct).toFixed(2)) : 0,
      avgSpend: distinct ? Number((orderAmount / distinct).toFixed(2)) : 0,
      atRisk,
      withDob,
      withEmail,
      birthdaysThisMonth,
    },
  });
});

// Load a customer the caller is allowed to see.
const findScopedCustomer = async (req, res, id) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400);
    throw new Error('Invalid customer id');
  }
  const scope = await buildBranchFilter(req);
  const customer = await Customer.findOne({ ...scope, _id: id })
    .populate('memberships.cafe', 'name')
    .populate('memberships.branches', 'name city')
    .populate('memberships.firstBranch', 'name city')
    .lean();
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  return customer;
};

// @desc    Customer 360
// @route   GET /api/customers/:id
const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await findScopedCustomer(req, res, req.params.id);
  res.json({ success: true, data: customer });
});

// @desc    That customer's orders, with its own date filter
// @route   GET /api/customers/:id/orders
const getCustomerOrders = asyncHandler(async (req, res) => {
  const customer = await findScopedCustomer(req, res, req.params.id);
  const { startDate, endDate, page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = clampLimit(limit, 20, 200);

  // Scope to branches the CALLER can access — never the customer's whole history.
  const match = await orderScopeMatch(req);
  const range = parseRange(startDate, endDate);
  if (range) match.createdAt = range;
  // Join on the stamped id, falling back to the phone for pre-migration orders.
  match.$or = [{ customerId: customer._id }, { customerPhone: customer.phone }];

  const [orders, totals, byDate] = await Promise.all([
    Order.find(match)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('branch', 'name city')
      .populate('coupon', 'code discountType discountValue')
      // Everything the order-detail popup needs (items already carry the snapshot
      // name/price/qty/modifiers), so no extra round-trip per order.
      .select('createdAt branch items totalAmount grandTotal discountAmount taxAmount amountPaid paymentType status coupon orderType')
      .lean(),
    Order.aggregate([
      { $match: match },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          amount: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: orders,
    totals: { count: totals[0]?.count || 0, amount: totals[0]?.amount || 0 },
    byDate: byDate.map((d) => ({ date: d._id, count: d.count, amount: d.amount })),
  });
});

// @desc    Rich per-customer analytics for the detail page: where they spend,
//          what they order, how often they come, discounts & coupons.
// @route   GET /api/customers/:id/insights
const getCustomerInsights = asyncHandler(async (req, res) => {
  const customer = await findScopedCustomer(req, res, req.params.id);

  // Scope to the CALLER's branches (same rule as the order list).
  const match = await orderScopeMatch(req);
  match.$or = [{ customerId: customer._id }, { customerPhone: customer.phone }];
  const spendExpr = { $ifNull: ['$grandTotal', '$totalAmount'] };

  const [perCafe, topItems, topCategories, discountAgg, couponAgg, orderTimes, byMonth] = await Promise.all([
    // Orders + spend per cafe (branch -> location -> cafe).
    Order.aggregate([
      { $match: match },
      { $lookup: { from: 'locations', localField: 'branch', foreignField: '_id', as: 'loc' } },
      { $unwind: { path: '$loc', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'cafes', localField: 'loc.cafe', foreignField: '_id', as: 'cafe' } },
      { $unwind: { path: '$cafe', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$cafe._id', cafeName: { $first: '$cafe.name' }, orders: { $sum: 1 }, spend: { $sum: spendExpr }, lastVisit: { $max: '$createdAt' } } },
      { $sort: { orders: -1 } },
    ]),
    // Most-ordered items (by quantity).
    Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $group: { _id: '$items.itemName', count: { $sum: '$items.quantity' }, spend: { $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, '$items.quantity'] } } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    // Favourite categories (item -> menuItem -> category).
    Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $lookup: { from: 'menuitems', localField: 'items.menuItem', foreignField: '_id', as: 'mi' } },
      { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'categories', localField: 'mi.category', foreignField: '_id', as: 'cat' } },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$cat.name', count: { $sum: '$items.quantity' } } },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    // Total discount taken.
    Order.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$discountAmount', 0] } }, withDiscount: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$discountAmount', 0] }, 0] }, 1, 0] } }, orders: { $sum: 1 } } },
    ]),
    // Coupons used, grouped by code.
    Order.aggregate([
      { $match: { ...match, coupon: { $ne: null } } },
      { $group: { _id: '$coupon', count: { $sum: 1 } } },
      { $lookup: { from: 'coupons', localField: '_id', foreignField: '_id', as: 'c' } },
      { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
      { $project: { code: '$c.code', count: 1 } },
      { $sort: { count: -1 } },
    ]),
    // Ordered timestamps for the average-gap-between-visits calc.
    Order.find(match).select('createdAt').sort({ createdAt: 1 }).lean(),
    // Monthly trend.
    Order.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 }, spend: { $sum: spendExpr } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Average gap (days) between consecutive orders.
  const times = orderTimes.map((d) => new Date(d.createdAt).getTime()).filter(Boolean);
  let avgGapDays = null;
  if (times.length >= 2) {
    let sum = 0;
    for (let i = 1; i < times.length; i += 1) sum += times[i] - times[i - 1];
    avgGapDays = Math.round((sum / (times.length - 1)) / (24 * 60 * 60 * 1000) * 10) / 10;
  }

  const disc = discountAgg[0] || {};
  res.json({
    success: true,
    data: {
      perCafe: perCafe.map((c) => ({ cafeId: c._id, cafeName: c.cafeName || 'Unknown cafe', orders: c.orders, spend: c.spend, lastVisit: c.lastVisit })),
      topItems: topItems.map((i) => ({ name: i._id || 'Item', count: i.count, spend: i.spend })),
      topCategories: topCategories.map((c) => ({ category: c._id, count: c.count })),
      discount: { total: disc.total || 0, ordersWithDiscount: disc.withDiscount || 0, totalOrders: disc.orders || 0 },
      coupons: { totalUsed: couponAgg.reduce((s, c) => s + c.count, 0), byCoupon: couponAgg.map((c) => ({ code: c.code || '—', count: c.count })) },
      avgGapDays,
      firstOrderAt: times.length ? new Date(times[0]) : null,
      lastOrderAt: times.length ? new Date(times[times.length - 1]) : null,
      totalOrders: times.length,
      byMonth: byMonth.map((m) => ({ month: m._id, count: m.count, spend: m.spend })),
    },
  });
});

// @desc    Staff-side edit. DOB only while unlocked.
// @route   PATCH /api/customers/:id
const updateCustomer = asyncHandler(async (req, res) => {
  await findScopedCustomer(req, res, req.params.id); // scope check
  const customer = await Customer.findById(req.params.id);

  const { name, gender, email, phone, dob } = req.body || {};

  if (name !== undefined) {
    const clean = String(name || '').trim().slice(0, 120);
    if (!clean) { res.status(400); throw new Error('Name is required'); }
    customer.name = clean;
  }
  if (gender !== undefined) {
    const allowed = ['male', 'female', 'other', 'prefer_not_to_say'];
    customer.gender = allowed.includes(gender) ? gender : null;
  }
  if (email !== undefined) {
    if (!email) customer.email = null;
    else {
      const clean = String(email).trim().toLowerCase().slice(0, 160);
      if (!/^\S+@\S+\.\S+$/.test(clean)) { res.status(400); throw new Error('Invalid email address'); }
      customer.email = clean;
    }
  }
  if (phone !== undefined) {
    const clean = normalizePhone(phone);
    if (clean.length < 10) { res.status(400); throw new Error('Invalid phone number'); }
    if (clean !== customer.phone) {
      const clash = await Customer.findOne({ phone: clean }).select('_id').lean();
      if (clash && String(clash._id) !== String(customer._id)) {
        res.status(409);
        throw new Error('That number is already registered to another customer');
      }
      customer.phone = clean;
    }
  }
  if (dob !== undefined && dob !== null && dob !== '') {
    if (customer.dobLockedAt) {
      res.status(400);
      throw new Error('Date of birth cannot be changed once set');
    }
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) { res.status(400); throw new Error('Invalid date of birth'); }
    customer.dob = d;
  }

  await customer.save();
  await logActivity(
    req.user,
    'CUSTOMER_UPDATE',
    `Updated customer: ${customer.name}`,
    req,
    { customerId: customer._id }
  );

  res.json({ success: true, data: customer });
});

// @desc    Customers whose birthday falls in range
// @route   GET /api/customers/birthdays
const getCustomerBirthdays = asyncHandler(async (req, res) => {
  const { scope = 'today' } = req.query;
  const base = await buildBranchFilter(req);
  const now = new Date();

  let filter;
  if (scope === 'month') {
    filter = { dobMonth: now.getMonth() + 1 };
  } else if (scope === 'week') {
    // Build the 7 (month, day) pairs so it stays an index hit across a month edge.
    const pairs = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      pairs.push({ dobMonth: d.getMonth() + 1, dobDay: d.getDate() });
    }
    filter = { $or: pairs };
  } else {
    filter = { dobMonth: now.getMonth() + 1, dobDay: now.getDate() };
  }

  const rows = await Customer.find({ ...base, ...filter })
    .select('name phone email dob dobMonth dobDay memberships totalSpend visits')
    .populate('memberships.cafe', 'name')
    .limit(500)
    .lean();

  res.json({ success: true, count: rows.length, data: rows });
});

// @desc    Effective crm settings + which tier supplied them
// @route   GET /api/customers/discount-config
const getDiscountConfig = asyncHandler(async (req, res) => {
  const { cafeId, locationId } = req.query;
  if (locationId && !isAllLocation(locationId) && !canAccessLocation(req.user, locationId)) {
    res.status(403);
    throw new Error('Permission denied to this location');
  }
  const { settings, sources } = await getSettingsWithSources({
    locationId: locationId && !isAllLocation(locationId) ? locationId : null,
    cafeId: cafeId && !isAllLocation(cafeId) ? cafeId : null,
  });

  // Report the strongest tier that supplied any crm key.
  const order = { default: 0, global: 1, cafe: 2, branch: 3 };
  let level = 'default';
  for (const key of Object.keys(settings.crm || {})) {
    const src = sources[`crm.${key}`] || 'default';
    if (order[src] > order[level]) level = src;
  }

  res.json({ success: true, data: { crm: settings.crm, level, sources } });
});

// @desc    Write the crm settings group at the requested tier
// @route   PUT /api/customers/discount-config
const updateDiscountConfig = asyncHandler(async (req, res) => {
  const { cafeId, locationId, crm } = req.body || {};
  if (!crm || typeof crm !== 'object') {
    res.status(400);
    throw new Error('Nothing to update');
  }

  const role = req.user.role;
  const Settings = require('../models/Settings');

  let filter;
  if (locationId) {
    if (!canAccessLocation(req.user, locationId)) {
      res.status(403);
      throw new Error('Permission denied to this branch');
    }
    filter = { locationId: new mongoose.Types.ObjectId(String(locationId)), cafeId: null };
  } else if (cafeId) {
    // Only super_admin and admin may write the CAFE tier; a branch/location admin
    // is scoped to their own branch and must never reconfigure a whole cafe.
    if (!['super_admin', 'admin'].includes(role)) {
      res.status(403);
      throw new Error('Only a cafe owner can change cafe-wide settings');
    }
    if (role === 'admin') {
      const mine = (req.user.cafes || []).map(String);
      if (!mine.includes(String(cafeId))) {
        res.status(403);
        throw new Error('Permission denied to this cafe');
      }
    }
    filter = { locationId: null, cafeId: new mongoose.Types.ObjectId(String(cafeId)) };
  } else {
    if (role !== 'super_admin') {
      res.status(403);
      throw new Error('Only a super admin can change the global default');
    }
    filter = { locationId: null, cafeId: null };
  }

  // Write ONLY the provided keys, as dotted paths, so unspecified keys keep
  // inheriting from the tier beneath instead of being frozen at this level.
  const allowed = [
    'newCustomerDiscountEnabled', 'newCustomerDiscountPercent', 'newCustomerMaxDiscount',
    'newCustomerMinOrder', 'askProfileOnScan', 'profileRequired',
  ];
  const $set = {};
  for (const key of allowed) {
    if (crm[key] !== undefined) $set[`crm.${key}`] = crm[key];
  }
  if (Object.keys($set).length === 0) {
    res.status(400);
    throw new Error('Nothing to update');
  }

  const doc = await Settings.findOneAndUpdate(
    filter,
    { $set, $setOnInsert: filter },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const tier = locationId ? 'branch' : cafeId ? 'cafe' : 'global';
  await logActivity(
    req.user,
    'CRM_DISCOUNT_CONFIG',
    `Updated CRM discount config (${tier})`,
    req,
    { tier, cafeId: cafeId || null, locationId: locationId || null }
  );
  res.json({ success: true, data: { crm: doc.crm } });
});

// ── Birthday / targeted coupon campaigns ─────────────────────────────────────

const randomCode = (prefix) => {
  const body = Array.from({ length: 6 }, () =>
    'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 33)]).join('');
  return `${prefix}-${body}`;
};

// Reserve a code that is actually free. `code` is uniquely indexed, so rather than
// assuming randomness is enough (the loyalty-reward minting elsewhere does assume
// that, and can collide), retry until the DB accepts one.
const reserveUniqueCode = async (prefix, taken) => {
  const Coupon = require('../models/Coupon');
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCode(prefix);
    if (taken.has(code)) continue;
    // eslint-disable-next-line no-await-in-loop
    const clash = await Coupon.exists({ code });
    if (!clash) {
      taken.add(code);
      return code;
    }
  }
  throw new Error('Could not allocate a unique coupon code — please retry');
};

// @desc    Generate a birthday coupon batch
// @route   POST /api/customers/campaigns/birthday
const generateBirthdayCampaign = asyncHandler(async (req, res) => {
  const {
    scope = 'today', startDate, endDate, cafeId, branchIds = [],
    discountType = 'percentage', discountValue, maxDiscount = null, minOrderAmount = 0,
    validDays = 7, appliesTo = { items: [], categories: [] },
    codePrefix = 'BDAY', perCustomerCode = true,
  } = req.body || {};

  const Coupon = require('../models/Coupon');

  if (!discountValue || Number(discountValue) <= 0) {
    res.status(400);
    throw new Error('Enter a discount value');
  }

  // ── Authorisation: the caller must be able to reach the requested cafe/branches
  const role = req.user.role;
  if (cafeId && !isAllLocation(cafeId)) {
    if (role === 'admin' && !(req.user.cafes || []).map(String).includes(String(cafeId))) {
      res.status(403);
      throw new Error('Permission denied to this cafe');
    }
    if (['branch_admin', 'location_admin'].includes(role)) {
      // A branch-level admin may only target their own branches, never a whole cafe.
      const mine = userLocationIds(req.user).map(String);
      const requested = (branchIds || []).map(String);
      if (requested.length === 0 || !requested.every((b) => mine.includes(b))) {
        res.status(403);
        throw new Error('You can only run campaigns for your own branch');
      }
    }
  } else if (role !== 'super_admin' && (branchIds || []).length === 0) {
    res.status(400);
    throw new Error('Select a cafe or branch for this campaign');
  }
  for (const b of branchIds || []) {
    if (!canAccessLocation(req.user, b)) {
      res.status(403);
      throw new Error('Permission denied to one of the selected branches');
    }
  }

  // ── Target selection: reuse the same scoping the report uses
  const base = await buildBranchFilter(req);
  const now = new Date();
  let dobFilter;
  if (scope === 'custom' && startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const pairs = [];
    for (let d = new Date(s); d <= e && pairs.length < 366; d.setDate(d.getDate() + 1)) {
      pairs.push({ dobMonth: d.getMonth() + 1, dobDay: d.getDate() });
    }
    dobFilter = pairs.length ? { $or: pairs } : { dobMonth: -1 };
  } else if (scope === 'month') {
    dobFilter = { dobMonth: now.getMonth() + 1 };
  } else if (scope === 'week') {
    const pairs = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      pairs.push({ dobMonth: d.getMonth() + 1, dobDay: d.getDate() });
    }
    dobFilter = { $or: pairs };
  } else {
    dobFilter = { dobMonth: now.getMonth() + 1, dobDay: now.getDate() };
  }

  const targetQuery = { ...base, ...dobFilter, dob: { $ne: null } };
  if (cafeId && !isAllLocation(cafeId)) {
    targetQuery['memberships.cafe'] = new mongoose.Types.ObjectId(String(cafeId));
  }
  if ((branchIds || []).length) {
    targetQuery['memberships.branches'] = { $in: branchIds.map((b) => new mongoose.Types.ObjectId(String(b))) };
  }

  const targets = await Customer.find(targetQuery).select('_id name phone').limit(2000).lean();
  if (targets.length === 0) {
    return res.json({ success: true, data: { batchId: null, created: 0, skipped: 0, sample: [], targets: 0 } });
  }

  const batchId = `bday_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiry = new Date(now.getTime() + (Number(validDays) || 7) * 24 * 60 * 60 * 1000);
  const prefix = String(codePrefix || 'BDAY').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'BDAY';

  const shared = {
    discountType: discountType === 'fixed' ? 'fixed' : 'percentage',
    discountValue: Number(discountValue),
    maxDiscount: maxDiscount === null || maxDiscount === '' ? null : Number(maxDiscount),
    minOrderAmount: Number(minOrderAmount) || 0,
    expiryDate: expiry,
    isActive: true,
    createdBy: req.user._id,
    cafe: cafeId && !isAllLocation(cafeId) ? new mongoose.Types.ObjectId(String(cafeId)) : null,
    branches: (branchIds || []).map((b) => new mongoose.Types.ObjectId(String(b))),
    audience: 'birthday',
    appliesTo: {
      items: (appliesTo?.items || []).map((i) => new mongoose.Types.ObjectId(String(i))),
      categories: (appliesTo?.categories || []).map((c) => new mongoose.Types.ObjectId(String(c))),
    },
    campaign: { batchId, kind: 'birthday', generatedAt: now },
  };

  const taken = new Set();
  let docs;
  if (perCustomerCode) {
    docs = [];
    for (const t of targets) {
      // eslint-disable-next-line no-await-in-loop
      const code = await reserveUniqueCode(prefix, taken);
      docs.push({ ...shared, code, usageLimit: 1, assignedCustomers: [t._id] });
    }
  } else {
    const code = await reserveUniqueCode(prefix, taken);
    docs = [{ ...shared, code, usageLimit: targets.length, assignedCustomers: targets.map((t) => t._id) }];
  }

  // ordered:false so one duplicate can't abort the whole batch.
  let created = 0;
  try {
    const inserted = await Coupon.insertMany(docs, { ordered: false });
    created = inserted.length;
  } catch (err) {
    created = err?.result?.nInserted ?? err?.insertedDocs?.length ?? 0;
  }

  await logActivity(
    req.user,
    'CRM_BIRTHDAY_CAMPAIGN',
    `Generated ${created} birthday coupon(s) [${batchId}]`,
    req,
    { batchId, targets: targets.length, cafeId: cafeId || null }
  );

  res.status(201).json({
    success: true,
    data: {
      batchId,
      created,
      skipped: docs.length - created,
      targets: targets.length,
      sample: docs.slice(0, 5).map((d) => d.code),
    },
  });
});

// @desc    List past campaign batches
// @route   GET /api/customers/campaigns
const listCampaigns = asyncHandler(async (req, res) => {
  const Coupon = require('../models/Coupon');
  const match = { 'campaign.batchId': { $ne: null } };
  if (req.user.role !== 'super_admin') {
    const cafes = (req.user.cafes || []).map((c) => new mongoose.Types.ObjectId(String(c)));
    const branches = userLocationIds(req.user).map((b) => new mongoose.Types.ObjectId(String(b)));
    match.$or = [{ cafe: { $in: cafes } }, { branches: { $in: branches } }];
  }

  const batches = await Coupon.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$campaign.batchId',
        kind: { $first: '$campaign.kind' },
        generatedAt: { $first: '$campaign.generatedAt' },
        cafe: { $first: '$cafe' },
        coupons: { $sum: 1 },
        redeemed: { $sum: '$usedCount' },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
      },
    },
    { $sort: { generatedAt: -1 } },
    { $limit: 100 },
  ]);

  res.json({ success: true, count: batches.length, data: batches.map((b) => ({ batchId: b._id, ...b })) });
});

// @desc    Activate / deactivate an entire batch
// @route   PATCH /api/customers/campaigns/:batchId
const updateCampaign = asyncHandler(async (req, res) => {
  const Coupon = require('../models/Coupon');
  const { isActive } = req.body || {};
  if (typeof isActive !== 'boolean') {
    res.status(400);
    throw new Error('isActive must be true or false');
  }

  const match = { 'campaign.batchId': req.params.batchId };
  if (req.user.role !== 'super_admin') {
    const cafes = (req.user.cafes || []).map((c) => new mongoose.Types.ObjectId(String(c)));
    const branches = userLocationIds(req.user).map((b) => new mongoose.Types.ObjectId(String(b)));
    match.$or = [{ cafe: { $in: cafes } }, { branches: { $in: branches } }];
  }

  const result = await Coupon.updateMany(match, { $set: { isActive } });
  if (!result.matchedCount) {
    res.status(404);
    throw new Error('Campaign not found');
  }

  await logActivity(
    req.user,
    'CRM_CAMPAIGN_UPDATE',
    `${isActive ? 'Reactivated' : 'Deactivated'} campaign ${req.params.batchId}`,
    req,
    { batchId: req.params.batchId }
  );

  res.json({ success: true, data: { updated: result.modifiedCount } });
});

// ── Deletion ─────────────────────────────────────────────────────────────────

// @desc    Remove a customer. Membership-only for cafe staff, full erase for super admin.
// @route   DELETE /api/customers/:id
// @access  Private (customers.delete)
//
// A Customer is a GLOBAL identity — one phone number is one human, shared by every
// cafe they have ever bought from (see models/Customer.js). So "delete" cannot mean
// the same thing for everybody: a branch admin pressing delete must not erase a
// person who is also a regular at three other cafes. Hence two distinct outcomes,
// and the response always states which one happened.
const deleteCustomer = asyncHandler(async (req, res) => {
  // A malformed id would surface as a CastError 500; the operator needs to know
  // their list is stale, not that the server broke.
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error('That customer id is not valid. Refresh the customer list and try again.');
  }

  const customer = await Customer.findById(req.params.id);
  requireRecord(res, customer, 'Customer');

  const isSuper = req.user.role === 'super_admin';
  const myBranches = new Set(userLocationIds(req.user).map(String));
  // Only a cafe-level `admin` owns a whole cafe. A branch_admin may also carry a
  // `cafes` array (it scopes their dropdowns), and reading it as ownership here
  // would silently let them close a membership covering branches they do not run.
  const myCafes = new Set(req.user.role === 'admin' ? (req.user.cafes || []).map(String) : []);
  const label = (customer.name || '').trim() || 'This customer';

  // Work out how much of this profile the caller may actually touch:
  //   - a cafe `admin` owns whole cafes (req.user.cafes) → the entire membership
  //   - a branch/location admin owns only their assigned branches, so they may
  //     detach THOSE branches. The membership itself only disappears once none of
  //     the branches the customer visited lie outside their remit — otherwise one
  //     branch admin would wipe the customer's history at four sibling branches.
  const plan = [];
  for (const m of customer.memberships || []) {
    const cafeId = normalizeId(m.cafe);
    const branchIds = (m.branches || []).map((b) => normalizeId(b)).filter(Boolean);
    const firstBranch = normalizeId(m.firstBranch);
    const ownsCafe = myCafes.has(cafeId);
    const mine = branchIds.filter((b) => myBranches.has(b));
    if (!isSuper && !ownsCafe && mine.length === 0 && !(firstBranch && myBranches.has(firstBranch))) continue;
    const whole = isSuper || ownsCafe || mine.length === branchIds.length;
    plan.push({ membership: m, cafeId, whole, detach: whole ? branchIds : mine });
  }

  // Scope refusal: a customer entirely outside the caller's cafes/branches.
  // super_admin is exempt — a profile with no memberships at all (an import, or a
  // QR scan that never converted) is still theirs to clean up.
  if (!isSuper && plan.length === 0) {
    res.status(403);
    throw new Error(
      `${label} has no membership at any cafe or branch you manage, so you cannot remove them. Ask the administrator of the branch they actually visit.`
    );
  }

  // Pin the record to a branch the caller can reach so Gate 2 judges the RECORD,
  // not the request. When nothing pins (a cafe-wide admin whose branch list is
  // empty) it falls through to the globalRoles check, which is the correct tier
  // for a cafe-wide identity.
  const reachableBranch = isSuper
    ? normalizeId(customer.branch)
    : plan.flatMap((p) => p.detach.concat(normalizeId(p.membership.firstBranch) || []))
      .find((b) => myBranches.has(b));

  assertCanDelete(req, res, {
    resource: 'customer',
    actionKey: 'customers.delete',
    locationId: reachableBranch || undefined,
    globalRoles: ['super_admin', 'admin'],
  });

  // Money guard: loyalty points are a balance the guest already earned and can
  // still spend. Closing the membership destroys it with no reversal trail, so a
  // cafe-level actor is pointed at the safe alternative; a super admin may force it.
  const pointsAtStake = plan.reduce((sum, p) => sum + (p.whole ? (p.membership.loyaltyPoints || 0) : 0), 0);
  if (!isSuper && pointsAtStake > 0) {
    res.status(400);
    throw new Error(
      `${label} still holds ${pointsAtStake} unredeemed loyalty point(s) with you. Redeem or zero the points first, then remove them — otherwise the guest silently loses a balance they earned.`
    );
  }

  // Counted BEFORE anything changes. Orders are never deleted here (see below), so
  // this is the number that keeps their name on the books.
  const ordersRetained = await Order.countDocuments({
    $or: [{ customerId: customer._id }, { customerPhone: customer.phone }],
  });

  const membershipsClosed = plan.filter((p) => p.whole).length;
  let branchesDetached = 0;
  let message;
  let detail;

  if (isSuper) {
    await customer.deleteOne();

    // Cascade 1 — orders are KEPT on purpose: each carries its own customerName /
    // customerPhone snapshot, so revenue and sales history stay complete and
    // auditable after the profile goes. Only the now-dangling `customerId` pointer
    // is cleared. The phone stays the join key (getCustomerOrders already falls
    // back to it), so if the same person ever registers again their history
    // re-attaches by itself.
    await Order.updateMany({ customerId: customer._id }, { $set: { customerId: null } });

    // Cascade 2 — birthday/targeted coupons minted FOR this person. Leaving the id
    // behind keeps dead "assigned" rows counting as active in the campaign report.
    // A non-public coupon whose assignedCustomers empties out is already refused at
    // redemption (couponController), so deactivate exactly those instead of
    // leaving inert rows advertised as live.
    const Coupon = require('../models/Coupon');
    const touched = await Coupon.find({ assignedCustomers: customer._id }).select('_id').lean();
    if (touched.length) {
      const ids = touched.map((c) => c._id);
      await Coupon.updateMany({ _id: { $in: ids } }, { $pull: { assignedCustomers: customer._id } });
      await Coupon.updateMany(
        { _id: { $in: ids }, audience: { $ne: 'public' }, assignedCustomers: { $size: 0 } },
        { $set: { isActive: false } }
      );
    }

    branchesDetached = plan.reduce((n, p) => n + p.detach.length, 0);
    message = `${label} was permanently deleted, including their global profile and all ${plan.length} cafe membership(s). ${ordersRetained} past order(s) were kept — they carry their own name and phone snapshot — and are no longer linked to a customer record.`;
    detail = `Global profile erased. ${ordersRetained} order(s) kept under the stored name/phone.`;
  } else {
    const wholeCafes = new Set(plan.filter((p) => p.whole).map((p) => p.cafeId));
    const partial = new Map(plan.filter((p) => !p.whole).map((p) => [p.cafeId, new Set(p.detach)]));

    const kept = [];
    for (const m of customer.memberships) {
      const cafeId = normalizeId(m.cafe);
      if (wholeCafes.has(cafeId)) {
        branchesDetached += (m.branches || []).length;
        continue; // membership closed entirely
      }
      const drop = partial.get(cafeId);
      if (drop && drop.size) {
        m.branches = (m.branches || []).filter((b) => !drop.has(normalizeId(b)));
        // The acquisition branch is one of the ones we just detached. Clearing it is
        // the honest move — repointing it at a branch that did NOT acquire them
        // would fabricate provenance. The per-cafe totals are left alone: they are
        // cafe-wide figures and the sibling branches still legitimately own them.
        if (m.firstBranch && drop.has(normalizeId(m.firstBranch))) m.firstBranch = null;
        branchesDetached += drop.size;
      }
      kept.push(m);
    }
    customer.memberships = kept;

    // The top-level numbers are roll-ups ACROSS memberships and /top, /inactive,
    // /analytics and the CRM report all sort on them. Left untouched, a customer we
    // just detached would keep ranking as one of the biggest spenders in a cafe
    // they no longer belong to — so rebuild them from what actually remains.
    customer.visits = kept.reduce((n, m) => n + (m.orderCount || 0), 0);
    customer.totalSpend = kept.reduce((n, m) => n + (m.totalSpend || 0), 0);
    customer.loyaltyPoints = kept.reduce((n, m) => n + (m.loyaltyPoints || 0), 0);
    const seen = kept.map((m) => m.lastVisit).filter(Boolean).map((d) => new Date(d).getTime());
    if (seen.length) customer.lastVisit = new Date(Math.max(...seen));

    // `branch` (the original acquisition branch) is required by the schema and is
    // never used for scoping — buildBranchFilter matches on memberships.branches —
    // so it is left as historical provenance rather than forced to a wrong value.
    await customer.save();

    message = `${label} was removed from your customer list — ${membershipsClosed} cafe membership(s) closed and ${branchesDetached} branch link(s) detached. Their global profile was NOT deleted: one phone number is one person across every cafe, so only a super admin can erase it. ${ordersRetained} past order(s) remain attributed to them by name and phone.`;
    detail = `Membership only — the global profile was kept. ${ordersRetained} order(s) remain attributed.`;
  }

  await announceDeletion(req, {
    resource: 'Customer',
    name: `${label} (${customer.phone})`,
    locationId: reachableBranch || undefined,
    action: 'CUSTOMER_DELETE',
    type: 'activity',
    // High: this changes CRM totals and, for a super admin, is irreversible.
    priority: 'high',
    detail,
    // A deletion is only reviewable if what disappeared is still readable.
    metadata: {
      customerId: customer._id.toString(),
      phone: customer.phone,
      email: customer.email || null,
      hardDeleted: isSuper,
      membershipsClosed,
      branchesDetached,
      ordersRetained,
      totalSpendAtDeletion: customer.totalSpend,
      loyaltyPointsAtDeletion: pointsAtStake,
    },
  });

  res.json({
    success: true,
    message,
    data: {
      hardDeleted: isSuper,
      membershipsClosed,
      branchesDetached,
      membershipsRemaining: isSuper ? 0 : customer.memberships.length,
      ordersRetained,
    },
  });
});

module.exports = {
  getCustomers,
  getTopCustomers,
  getInactiveCustomers,
  getCustomerAnalytics,
  generateBirthdayCampaign,
  listCampaigns,
  updateCampaign,
  getCustomerReport,
  getCustomerSummary,
  getCustomerById,
  getCustomerOrders,
  getCustomerInsights,
  updateCustomer,
  getCustomerBirthdays,
  getDiscountConfig,
  updateDiscountConfig,
  deleteCustomer,
};
