const asyncHandler = require('../utils/asyncHandler');
const CashSession = require('../models/CashSession');
const Order = require('../models/Order');
const { canAccessLocation, endOfDay, clampLimit, userLocationIds } = require('../utils/accessControl');

// Resolve which branch the request acts on. Branch-scoped roles always use their
// assigned location; admins/super admins must pass a locationId they can access.
const resolveBranch = (req, res) => {
  const branchScoped = ['staff', 'chef', 'branch_admin', 'location_admin'].includes(req.user.role);
  let locationId = branchScoped ? req.user.assignedLocation : (req.body.locationId || req.query.locationId);
  if (!locationId) {
    res.status(400);
    throw new Error('A branch (locationId) is required for cash-drawer actions');
  }
  if (!branchScoped && req.user.role !== 'super_admin' && !canAccessLocation(req.user, locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch');
  }
  return locationId;
};

// Sum cash orders (and cash refunds) for a branch within a time window.
// Cash actually collected at completion = grandTotal (incl. GST/service charge);
// fall back to amountPaid for orders completed before grandTotal was persisted.
// IMPORTANT: a refund zeroes amountPaid, so the refund total must be summed on a
// field that survives the refund (grandTotal, fallback totalAmount). The sales
// query intentionally does NOT exclude later-refunded orders — pairing "sale in
// (by completedAt) + refund out (by refundedAt)" makes a same-shift refund net to
// zero and a cross-shift refund subtract from the shift that paid the cash out.
// KNOWN LIMITATION: cash collected via partial payments on a still-open tab
// (recordPayment before completion) is attributed to the shift in which the order
// finally COMPLETES (by completedAt), not the shift the cash physically arrived.
// Precise per-receipt attribution needs a payment-event ledger (future work).
const objId = (id) => new (require('mongoose').Types.ObjectId)(id.toString());
const computeCashFlow = async (locationId, from, to) => {
  const collected = { $cond: [{ $gt: [{ $ifNull: ['$grandTotal', 0] }, 0] }, '$grandTotal', { $ifNull: ['$amountPaid', 0] }] };
  const returned = { $cond: [{ $gt: [{ $ifNull: ['$grandTotal', 0] }, 0] }, '$grandTotal', { $ifNull: ['$totalAmount', 0] }] };
  const [sales, refunds] = await Promise.all([
    Order.aggregate([
      { $match: { branch: objId(locationId), paymentType: 'CASH', status: 'COMPLETED', completedAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: collected }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { branch: objId(locationId), paymentType: 'CASH', isRefunded: true, refundedAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: returned } } },
    ]),
  ]);
  return {
    cashSales: sales[0]?.total || 0,
    cashOrders: sales[0]?.count || 0,
    cashRefunds: refunds[0]?.total || 0,
  };
};

const movementTotals = (movements = []) => ({
  cashIn: movements.filter((m) => m.type === 'in').reduce((a, m) => a + (m.amount || 0), 0),
  cashOut: movements.filter((m) => m.type === 'out').reduce((a, m) => a + (m.amount || 0), 0),
});

// @desc    Open the cash drawer for a branch
// @route   POST /api/cash-drawer/open
const openDrawer = asyncHandler(async (req, res) => {
  const locationId = resolveBranch(req, res);
  const openingFloat = Number(req.body.openingFloat) || 0;
  if (openingFloat < 0) {
    res.status(400);
    throw new Error('Opening float cannot be negative');
  }

  const existing = await CashSession.findOne({ locationId, status: 'open' });
  if (existing) {
    res.status(400);
    throw new Error('A cash drawer is already open for this branch. Close it first.');
  }

  try {
    const session = await CashSession.create({
      locationId,
      openedBy: req.user._id,
      openingFloat,
      status: 'open',
    });
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    // Unique partial index lost the race — another open drawer was just created.
    if (err.code === 11000) {
      res.status(400);
      throw new Error('A cash drawer is already open for this branch.');
    }
    throw err;
  }
});

// @desc    Get the current open drawer for a branch (with live expected cash)
// @route   GET /api/cash-drawer/current
const getCurrentDrawer = asyncHandler(async (req, res) => {
  const locationId = resolveBranch(req, res);
  const session = await CashSession.findOne({ locationId, status: 'open' })
    .populate('openedBy', 'name');
  if (!session) {
    return res.json({ success: true, data: null });
  }
  const flow = await computeCashFlow(locationId, session.openedAt, new Date());
  const { cashIn, cashOut } = movementTotals(session.movements);
  const expectedCash = session.openingFloat + flow.cashSales + cashIn - cashOut - flow.cashRefunds;
  res.json({
    success: true,
    data: { session, live: { ...flow, cashIn, cashOut, expectedCash } },
  });
});

// @desc    Record a cash pay-in / pay-out during the shift
// @route   POST /api/cash-drawer/:id/movement
const addMovement = asyncHandler(async (req, res) => {
  const { type, amount, reason } = req.body || {};
  if (!['in', 'out'].includes(type)) {
    res.status(400);
    throw new Error('Movement type must be "in" or "out"');
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    res.status(400);
    throw new Error('Movement amount must be a positive number');
  }

  const session = await CashSession.findById(req.params.id);
  if (!session || session.status !== 'open') {
    res.status(404);
    throw new Error('Open cash drawer not found');
  }
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, session.locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch');
  }

  session.movements.push({ type, amount: amt, reason: reason || '', by: req.user._id, at: new Date() });
  await session.save();
  res.json({ success: true, data: session });
});

// @desc    Close the drawer and produce the Z-report
// @route   POST /api/cash-drawer/:id/close
const closeDrawer = asyncHandler(async (req, res) => {
  const countedCash = Number(req.body.countedCash);
  if (!Number.isFinite(countedCash) || countedCash < 0) {
    res.status(400);
    throw new Error('Counted cash must be a non-negative number');
  }

  const session = await CashSession.findById(req.params.id);
  if (!session || session.status !== 'open') {
    res.status(404);
    throw new Error('Open cash drawer not found');
  }
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, session.locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch');
  }

  const closedAt = new Date();
  const flow = await computeCashFlow(session.locationId, session.openedAt, closedAt);
  const { cashIn, cashOut } = movementTotals(session.movements);
  const expectedCash = session.openingFloat + flow.cashSales + cashIn - cashOut - flow.cashRefunds;

  session.status = 'closed';
  session.closedBy = req.user._id;
  session.closedAt = closedAt;
  session.countedCash = countedCash;
  session.cashSales = flow.cashSales;
  session.cashRefunds = flow.cashRefunds;
  session.expectedCash = expectedCash;
  session.variance = Number((countedCash - expectedCash).toFixed(2));
  session.notes = (req.body.notes || '').toString().slice(0, 500);
  await session.save();

  res.json({ success: true, data: session });
});

// @desc    List past drawer sessions (Z-reports)
// @route   GET /api/cash-drawer
const getDrawerHistory = asyncHandler(async (req, res) => {
  const { startDate, endDate, status } = req.query;
  const branchScoped = ['staff', 'chef', 'branch_admin', 'location_admin'].includes(req.user.role);

  const match = {};
  if (branchScoped) {
    match.locationId = req.user.assignedLocation;
  } else if (req.query.locationId && req.query.locationId !== 'all') {
    if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, req.query.locationId)) {
      res.status(403);
      throw new Error('You do not have access to this branch');
    }
    match.locationId = req.query.locationId;
  } else if (req.user.role !== 'super_admin') {
    // Admin with no specific branch (or 'all'): restrict to their own branches —
    // never leak Z-reports system-wide. Only super_admin gets an unscoped view.
    match.locationId = { $in: userLocationIds(req.user) };
  }
  if (status) match.status = status;
  if (startDate || endDate) {
    match.openedAt = {};
    if (startDate) match.openedAt.$gte = new Date(startDate);
    if (endDate) match.openedAt.$lte = endOfDay(endDate);
  }

  const limit = clampLimit(req.query.limit, 50, 200);
  const sessions = await CashSession.find(match)
    .populate('openedBy', 'name')
    .populate('closedBy', 'name')
    .populate('locationId', 'name')
    .sort({ openedAt: -1 })
    .limit(limit);

  res.json({ success: true, data: sessions });
});

module.exports = { openDrawer, getCurrentDrawer, addMovement, closeDrawer, getDrawerHistory };
