const asyncHandler = require('../utils/asyncHandler');
const CashSession = require('../models/CashSession');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const sendNotification = require('../utils/sendNotification');
const { getIO } = require('../config/socket');
const { canAccessLocation, endOfDay, clampLimit, userLocationIds } = require('../utils/accessControl');
const { requireRecord, assertCanDelete, announceDeletion } = require('../utils/deleteGuard');

// Tell every client viewing this branch's drawer to refetch. Emitted whenever
// something changes the live balance: a cash order completing, a cash expense,
// a refund, or a manual pay-in/out. Best-effort — a noop IO (no socket server)
// silently does nothing.
const emitCashUpdate = (locationId) => {
  try {
    getIO().to(`branch_${locationId}`).emit('cashdrawer:update', { locationId: String(locationId) });
  } catch (_) { /* realtime is best-effort; never block the request */ }
};

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
  // Cash actually collected: a 'partial' order only had amountPaid handed over, so
  // it must NOT contribute its full grandTotal (that would inflate expected cash
  // and show a false shortage). A 'paid' order has amountPaid == grandTotal; legacy
  // orders with an unset paymentStatus fall back to grandTotal (then amountPaid).
  const collected = {
    $cond: [
      { $eq: ['$paymentStatus', 'partial'] },
      { $ifNull: ['$amountPaid', 0] },
      { $cond: [{ $gt: [{ $ifNull: ['$grandTotal', 0] }, 0] }, '$grandTotal', { $ifNull: ['$amountPaid', 0] }] },
    ],
  };
  const returned = { $cond: [{ $gt: [{ $ifNull: ['$grandTotal', 0] }, 0] }, '$grandTotal', { $ifNull: ['$totalAmount', 0] }] };
  const [sales, refunds] = await Promise.all([
    Order.aggregate([
      // Exclude orders that completed while still explicitly 'unpaid' (only possible
      // when billing.autoSettleOnComplete is off) — no cash was collected for those,
      // so they must not inflate expected cash. With auto-settle on (default) a
      // completed order is never 'unpaid', and legacy orders with an unset
      // paymentStatus are unaffected, so default reconciliation is unchanged.
      { $match: { branch: objId(locationId), paymentType: 'CASH', status: 'COMPLETED', paymentStatus: { $ne: 'unpaid' }, completedAt: { $gte: from, $lte: to } } },
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

// Cash-paid expenses for a branch within a time window. Read from the unified
// Transaction ledger (type EXPENSE) because BOTH expense paths land there — the
// proof-based POST /api/expenses (synced to a Transaction) and the manual
// POST /api/transactions. Only CASH expenses leave the register, so non-cash
// methods are excluded. ONLY 'approved' expenses reduce the drawer: a pending
// request has not been authorised to pay out yet, and a rejected one never will —
// so the cash only leaves the register once an admin approves the expense.
const computeCashExpenses = async (locationId, from, to) => {
  const rows = await Transaction.aggregate([
    {
      $match: {
        locationId: objId(locationId),
        type: 'EXPENSE',
        paymentType: 'CASH',
        status: 'approved',
        date: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
  ]);
  return { cashExpenses: rows[0]?.total || 0, expenseCount: rows[0]?.count || 0 };
};

// Build a single time-sorted activity feed for an open shift: every cash order
// (in), cash refund (out), cash expense (out) and manual pay-in/out (in/out),
// so the drawer shows the full history of what moved the balance — not just the
// aggregate totals. Newest first.
const buildLedgerEntries = async (locationId, session) => {
  const from = session.openedAt;
  const to = new Date();
  const [orders, refunds, expenses] = await Promise.all([
    Order.find({ branch: locationId, paymentType: 'CASH', status: 'COMPLETED', completedAt: { $gte: from, $lte: to } })
      .select('grandTotal totalAmount amountPaid completedAt customerName table invoiceNumber')
      .populate('table', 'tableNumber')
      .sort({ completedAt: -1 })
      .limit(200)
      .lean(),
    Order.find({ branch: locationId, paymentType: 'CASH', isRefunded: true, refundedAt: { $gte: from, $lte: to } })
      .select('grandTotal totalAmount refundedAt customerName refundReason')
      .sort({ refundedAt: -1 })
      .limit(100)
      .lean(),
    Transaction.find({ locationId, type: 'EXPENSE', paymentType: 'CASH', status: 'approved', date: { $gte: from, $lte: to } })
      .select('title totalAmount date category status')
      .sort({ date: -1 })
      .limit(200)
      .lean(),
  ]);

  const entries = [];
  for (const o of orders) {
    const amount = o.grandTotal > 0 ? o.grandTotal : (o.amountPaid || o.totalAmount || 0);
    entries.push({
      kind: 'sale',
      direction: 'in',
      amount,
      label: o.table?.tableNumber ? `Order · Table ${o.table.tableNumber}` : (o.customerName ? `Order · ${o.customerName}` : 'Cash order'),
      at: o.completedAt,
    });
  }
  for (const r of refunds) {
    entries.push({
      kind: 'refund',
      direction: 'out',
      amount: r.grandTotal > 0 ? r.grandTotal : (r.totalAmount || 0),
      label: r.refundReason ? `Refund · ${r.refundReason}` : 'Cash refund',
      at: r.refundedAt,
    });
  }
  for (const e of expenses) {
    entries.push({
      kind: 'expense',
      direction: 'out',
      amount: e.totalAmount || 0,
      label: `Expense · ${e.title || e.category || 'Expense'}`,
      at: e.date,
    });
  }
  for (const m of session.movements || []) {
    entries.push({
      kind: 'movement',
      direction: m.type,
      amount: m.amount || 0,
      label: m.reason || (m.type === 'in' ? 'Manual pay-in' : 'Manual pay-out'),
      at: m.at,
    });
  }

  entries.sort((a, b) => new Date(b.at) - new Date(a.at));
  return entries;
};

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
    await sendNotification({
      title: 'Cash drawer opened',
      message: `A cash drawer was opened by ${req.user.name}.`,
      type: 'activity',
      performedByUser: req.user,
      locationId,
    });
    emitCashUpdate(locationId);
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
    .populate('openedBy', 'name deletedAt');
  if (!session) {
    return res.json({ success: true, data: null });
  }
  const now = new Date();
  const [flow, exp, entries] = await Promise.all([
    computeCashFlow(locationId, session.openedAt, now),
    computeCashExpenses(locationId, session.openedAt, now),
    buildLedgerEntries(locationId, session),
  ]);
  const { cashIn, cashOut } = movementTotals(session.movements);
  const expectedCash = session.openingFloat + flow.cashSales + cashIn - cashOut - flow.cashRefunds - exp.cashExpenses;
  res.json({
    success: true,
    data: { session, live: { ...flow, ...exp, cashIn, cashOut, expectedCash }, entries },
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
  await sendNotification({
    title: 'Cash movement added',
    message: `A cash movement was added by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: session.locationId,
  });
  emitCashUpdate(session.locationId);
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
  const [flow, exp] = await Promise.all([
    computeCashFlow(session.locationId, session.openedAt, closedAt),
    computeCashExpenses(session.locationId, session.openedAt, closedAt),
  ]);
  const { cashIn, cashOut } = movementTotals(session.movements);
  const expectedCash = session.openingFloat + flow.cashSales + cashIn - cashOut - flow.cashRefunds - exp.cashExpenses;

  session.status = 'closed';
  session.closedBy = req.user._id;
  session.closedAt = closedAt;
  session.countedCash = countedCash;
  session.cashSales = flow.cashSales;
  session.cashRefunds = flow.cashRefunds;
  session.cashExpenses = exp.cashExpenses;
  session.expectedCash = expectedCash;
  session.variance = Number((countedCash - expectedCash).toFixed(2));
  session.notes = (req.body.notes || '').toString().slice(0, 500);
  await session.save();

  await sendNotification({
    title: 'Cash drawer closed',
    message: `A cash drawer was closed by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: session.locationId,
  });

  emitCashUpdate(session.locationId);
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
    .populate('openedBy', 'name deletedAt')
    .populate('closedBy', 'name deletedAt')
    .populate('locationId', 'name')
    .sort({ openedAt: -1 })
    .limit(limit);

  res.json({ success: true, data: sessions });
});

// @desc    Delete a drawer shift (Z-report)
// @route   DELETE /api/cash-drawer/:id
const deleteSession = asyncHandler(async (req, res) => {
  // Populate the branch so the error/notification text can name it — normalizeId()
  // inside the guards unwraps the populated doc, so scoping still works.
  const session = await CashSession.findById(req.params.id)
    .populate('locationId', 'name')
    .populate('openedBy', 'name deletedAt');
  requireRecord(res, session, 'Cash drawer shift');

  const locationId = session.locationId?._id || session.locationId;
  const branchName = session.locationId?.name || 'this branch';

  assertCanDelete(req, res, {
    resource: 'cash drawer shift',
    actionKey: 'cashdrawer.delete',
    locationId,
  });

  // GUARD 1 — an OPEN drawer is never deletable, not even by a super admin. The
  // unique partial index { locationId } on status:'open' is what keeps a branch to
  // one live register; removing the row mid-shift strands every cash order, refund
  // and pay-in already recorded against it (they are matched by the openedAt window,
  // which would vanish) and the cashier would be counting money with no shift to
  // reconcile it against. Closing first produces the Z-report, then it can go.
  if (session.status === 'open') {
    res.status(400);
    throw new Error(
      `This cash drawer is still open at ${branchName}. Close it with a physical count first — that produces the shift's Z-report — and only then can the shift be deleted.`
    );
  }

  // GUARD 2 — a CLOSED shift IS the Z-report: the counted cash, the expected cash
  // and the variance are the branch's proof of what was in the register that day.
  // Deleting one erases an audited reconciliation with no reversal, so it stays
  // super_admin-only regardless of the cashdrawer.delete flag. Everyone else has a
  // non-destructive alternative: correct the record in the shift notes.
  if (req.user.role !== 'super_admin') {
    const shiftDay = session.closedAt ? new Date(session.closedAt).toISOString().slice(0, 10) : 'unknown date';
    res.status(400);
    throw new Error(
      `This closed shift is ${branchName}'s Z-report for ${shiftDay} (counted ₹${session.countedCash ?? 0}, variance ₹${session.variance ?? 0}) and is the audit record of that day's cash. Only a super admin can delete a closed shift — ask one, or record the correction in the shift notes instead.`
    );
  }

  const variance = session.variance ?? 0;
  const openedById = (session.openedBy?._id || session.openedBy)?.toString();
  const closedById = (session.closedBy?._id || session.closedBy)?.toString();

  await session.deleteOne();

  // CASCADE DECISION: nothing is orphaned, so nothing is cleaned up. A shift OWNS
  // only its embedded movements (they go with the document). The cash orders,
  // refunds and expenses it reported were never linked to it — they live in Order /
  // Transaction and are matched to a shift purely by the openedAt..closedAt window,
  // so they stay intact and simply become unreported. Other shifts are unaffected:
  // each computes its own window from its own openedAt. The only real loss is the
  // reconciliation itself, which is why GUARD 2 keeps this to super admins.

  emitCashUpdate(locationId);

  await announceDeletion(req, {
    resource: 'Cash Drawer Shift',
    name: session.closedAt ? new Date(session.closedAt).toISOString().slice(0, 10) : String(session._id).slice(-6).toUpperCase(),
    locationId,
    action: 'CASHDRAWER_DELETE',
    // The cashier who ran the shift is usually not a manager, so the branch-manager
    // fan-out would never reach them — tell the people whose shift was removed.
    notifyUserIds: [openedById, closedById].filter(Boolean),
    detail: `The Z-report for ${branchName} (counted ₹${session.countedCash ?? 0}, expected ₹${session.expectedCash ?? 0}, variance ₹${variance}) is no longer on record; its cash orders and expenses remain in the ledger but are now unreconciled.`,
    metadata: {
      sessionId: String(session._id),
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openingFloat: session.openingFloat,
      countedCash: session.countedCash,
      expectedCash: session.expectedCash,
      variance,
    },
  });

  res.json({ success: true, message: 'Cash drawer shift removed' });
});

module.exports = { openDrawer, getCurrentDrawer, addMovement, closeDrawer, getDrawerHistory, deleteSession };
