const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const { enforceLocationAccess, canAccessLocation, escapeRegex, clampLimit, scopedLocationId, scopedLocationIds, userLocationIds, assertBranchesUnderOneAdmin } = require('../utils/accessControl');

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'ONLINE', 'GIFT_CARD', 'OTHER'];

// A cash expense changes the register balance — refresh any open drawer view.
const emitCashUpdate = (locationId) => {
  try {
    getIO().to(`branch_${locationId}`).emit('cashdrawer:update', { locationId: String(locationId) });
  } catch (_) { /* realtime is best-effort */ }
};

// @desc    Get all transactions (unified ledger with search, filters, pagination, RBAC)
// @route   GET /api/transactions
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const { type, locationId, locationIds, startDate, endDate, category, myExpenses, status, search, minAmount, maxAmount } = req.query;

  const query = {};

  if (type) query.type = type;
  if (category) query.category = category;
  if (status) {
    query.status = status;
  } else if (['super_admin', 'admin', 'branch_admin', 'location_admin'].includes(req.user.role)) {
    // Default to approved for admins to hide pending entries from "All" view
    query.status = 'approved';
  }

  // STRICT RBAC — support a single `locationId` OR a multi-branch `locationIds`
  // (comma-separated) filter. When `locationIds` is present it takes priority and
  // every id is validated against the caller's access; the result is an { $in: [] }
  // scoped to the branches they may see.
  const branchScope = locationIds
    ? scopedLocationIds(req, locationIds)
    : scopedLocationId(req, locationId);
  if (branchScope) query.locationId = branchScope;

  // Scope by user role and myExpenses flag
  if (req.user.role === 'staff' || req.user.role === 'chef') {
    query.createdBy = req.user._id;
  } else if (myExpenses === 'true') {
    query.createdBy = req.user._id;
  }

  // Search by title or customerName
  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), 'i');
    query.$or = [
      { title: searchRegex },
      { customerName: searchRegex },
    ];
  }

  // Amount Filtering
  if (minAmount || maxAmount) {
    query.totalAmount = {};
    if (minAmount) query.totalAmount.$gte = Number(minAmount);
    if (maxAmount) query.totalAmount.$lte = Number(maxAmount);
  }

  // Date range
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const startIndex = (page - 1) * limit;

  const total = await Transaction.countDocuments(query);

  const transactions = await Transaction.find(query)
    .populate('locationId', 'name city')
    .populate('staffId', 'name')
    .populate('createdBy', 'name role profileImageUrl')
    .populate('approvedBy', 'name role')
    .sort({ date: -1, createdAt: -1 })
    .skip(startIndex)
    .limit(limit)
    .lean();

  const mongoose = require('mongoose');
  const aggregateQuery = { ...query };

  // Totals/footer must never include pending/rejected rows unless the caller
  // explicitly asked for a specific status. Default to approved for ALL roles
  // (the list query above only defaults this for admin roles).
  if (!status) {
    aggregateQuery.status = 'approved';
  }

  if (aggregateQuery.locationId) {
    if (typeof aggregateQuery.locationId === 'string') {
      aggregateQuery.locationId = new mongoose.Types.ObjectId(aggregateQuery.locationId);
    } else if (aggregateQuery.locationId.$in && Array.isArray(aggregateQuery.locationId.$in)) {
      aggregateQuery.locationId = {
        $in: aggregateQuery.locationId.$in.map(id => new mongoose.Types.ObjectId(id.toString()))
      };
    }
  }

  if (aggregateQuery.createdBy) {
    aggregateQuery.createdBy = new mongoose.Types.ObjectId(aggregateQuery.createdBy.toString());
  }

  // Aggregate totals using the exact same query
  const totalStats = await Transaction.aggregate([
    { $match: aggregateQuery },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  let totalRevenue = 0;
  let totalExpense = 0;
  
  totalStats.forEach(stat => {
    if (stat._id && stat._id.toUpperCase() === 'EXPENSE') {
      totalExpense += stat.totalAmount;
    } else {
      totalRevenue += stat.totalAmount;
    }
  });

  res.json({
    success: true,
    count: transactions.length,
    total,
    totalRevenue,
    totalExpense,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      itemsPerPage: limit
    },
    data: transactions
  });
});

// @desc    Create a manual transaction (Expense/Revenue)
// @route   POST /api/transactions
// @access  Private
const createTransaction = asyncHandler(async (req, res) => {
  const { type, amount, title, category, locationId, date, description, paymentType, paymentMethod } = req.body;
  const tender = paymentType || paymentMethod;
  const finalPaymentType = PAYMENT_METHODS.includes(tender) ? tender : 'CASH';

  if (!type || !['MANUAL_REVENUE', 'EXPENSE'].includes(type)) {
    res.status(400);
    throw new Error('Valid transaction type (MANUAL_REVENUE or EXPENSE) is required');
  }

  // Amount must be positive — a negative EXPENSE would otherwise post as profit.
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    res.status(400);
    throw new Error('Amount must be a positive number');
  }

  let targetLocation = locationId;
  if (['staff', 'chef'].includes(req.user.role)) {
    targetLocation = req.user.assignedLocation;
  } else if (req.user.role === 'branch_admin') {
    targetLocation = locationId || req.user.assignedLocation;
  }

  if (!targetLocation) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  enforceLocationAccess(req, res, targetLocation, 'You do not have permission to create transactions for this location');

  // Handle billImage if uploaded (assuming multer is used in routes)
  const billImage = req.file ? req.file.path : undefined;

  // Determine initial status.
  //
  // DESIGN NOTE (intentional overlap): this manual /transactions path coexists
  // with the Expense approval+proof model (POST /api/expenses). Both can post an
  // EXPENSE to the ledger; the Expense path additionally enforces a proof image
  // and a richer approval workflow. We deliberately do NOT delete this path.
  //
  // Approval policy: an admin or branch admin OWNS the finances of their branch(es),
  // so their own entries post DIRECTLY (approved) with no approval step —
  // super_admin already did. Everyone else lands 'pending' and flows through the
  // approve/reject workflow. Segregation of duties is unaffected: it only governs
  // approving SOMEONE ELSE'S entry (enforced in approve/reject), not your own.
  const isAdminRole = ['admin', 'branch_admin'].includes(req.user.role);
  const autoApprove = req.user.role === 'super_admin' || isAdminRole;
  const status = autoApprove ? 'approved' : 'pending';

  const transaction = await Transaction.create({
    type,
    totalAmount: numAmount,
    totalProfit: type === 'MANUAL_REVENUE' ? numAmount : -numAmount, // Expense reduces total profit
    paymentType: finalPaymentType,
    title,
    category,
    locationId: targetLocation,
    date: date || new Date(),
    description,
    createdBy: req.user._id,
    approvedBy: autoApprove ? req.user._id : undefined,
    billImage,
    status
  });

  // A cash expense reduces the register balance — refresh any open drawer view.
  if (type === 'EXPENSE' && finalPaymentType === 'CASH') emitCashUpdate(targetLocation);

  // Notify Admins about new pending expense
  if (status === 'pending') {
    const admins = await User.find({
      $or: [
        { role: 'super_admin' },
        { role: 'admin', accessibleLocations: targetLocation },
        { role: 'branch_admin', $or: [{ assignedLocation: targetLocation }, { accessibleLocations: targetLocation }] }
      ]
    });

    if (admins.length > 0) {
      await Notification.create({
        title: 'New Expense Request',
        message: `${req.user.name} (${req.user.role}) has submitted a new expense of ₹${amount} for approval.`,
        type: 'expense',
        sender: req.user._id,
        locationTarget: targetLocation,
        recipients: admins.map(admin => ({ user: admin._id }))
      });
    }
  }

  res.status(201).json({
    success: true,
    data: transaction
  });
});

// @desc    Split one expense across several branches (one Transaction per branch)
// @route   POST /api/transactions/split
// @access  Private (Admin / Branch Admin / Super Admin — multi-branch owners)
//
// The caller supplies a `splits` array of { locationId, amount }. Each split
// becomes its own approved EXPENSE Transaction so the per-branch ledgers,
// analytics and cash drawers stay correct. Access to EVERY branch is validated;
// a branch admin's chosen branches must all sit under a single admin.
const splitTransaction = asyncHandler(async (req, res) => {
  const { title, category, date, description, paymentType, paymentMethod, splits } = req.body;

  // Only multi-branch owners may split. (staff/chef/location_admin can't.)
  const isAdminRole = ['admin', 'branch_admin'].includes(req.user.role);
  if (req.user.role !== 'super_admin' && !isAdminRole) {
    res.status(403);
    throw new Error('Only admins can split an expense across branches');
  }

  if (!title) {
    res.status(400);
    throw new Error('Title is required');
  }
  if (!category) {
    res.status(400);
    throw new Error('Category is required');
  }
  if (!Array.isArray(splits) || splits.length < 2) {
    res.status(400);
    throw new Error('A split expense needs at least two branches');
  }

  const tender = paymentType || paymentMethod;
  const finalPaymentType = PAYMENT_METHODS.includes(tender) ? tender : 'CASH';

  // Validate + normalize every split. Reject duplicates, bad amounts, and any
  // branch the caller cannot access.
  const seen = new Set();
  const normalized = [];
  for (const s of splits) {
    const locId = s && s.locationId;
    const amt = Number(s && s.amount);
    if (!locId) {
      res.status(400);
      throw new Error('Each split needs a branch');
    }
    if (seen.has(String(locId))) {
      res.status(400);
      throw new Error('Each branch can appear only once in a split');
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      res.status(400);
      throw new Error('Each split amount must be a positive number');
    }
    enforceLocationAccess(req, res, locId, 'You do not have permission for one of the selected branches');
    seen.add(String(locId));
    normalized.push({ locationId: locId, amount: amt });
  }

  // A branch admin may only split across branches that all belong to one admin.
  if (req.user.role === 'branch_admin') {
    await assertBranchesUnderOneAdmin(normalized.map((n) => n.locationId));
  }

  const when = date || new Date();
  const docs = normalized.map((n) => ({
    type: 'EXPENSE',
    totalAmount: n.amount,
    totalProfit: -n.amount,
    paymentType: finalPaymentType,
    title,
    category,
    locationId: n.locationId,
    date: when,
    description,
    createdBy: req.user._id,
    approvedBy: req.user._id, // admin/super_admin direct entry — no approval step
    status: 'approved',
  }));

  const created = await Transaction.insertMany(docs);

  // A cash split reduces each branch's register balance — refresh open drawers.
  if (finalPaymentType === 'CASH') {
    normalized.forEach((n) => emitCashUpdate(n.locationId));
  }

  const totalAmount = normalized.reduce((a, n) => a + n.amount, 0);
  res.status(201).json({
    success: true,
    count: created.length,
    totalAmount,
    data: created,
  });
});

// @desc    Add manual revenue to one OR many branches, with a separate amount per
//          branch and a shared, mandatory reason.
// @route   POST /api/transactions/revenue/bulk
// @access  Private (revenue.add)
//
// Each entry { locationId, amount } becomes its own MANUAL_REVENUE Transaction so
// the per-branch ledgers and analytics stay correct. Access to EVERY branch is
// validated. Admins post directly as approved; anyone else granted revenue.add
// lands as pending for an approver to sign off.
const createBulkRevenue = asyncHandler(async (req, res) => {
  const { entries, reason, title, category, date, description, paymentType, paymentMethod } = req.body;

  // Reason is mandatory — every off-order revenue adjustment must be justifiable.
  const finalReason = String(reason || '').trim();
  if (!finalReason) {
    res.status(400);
    throw new Error('A reason is required when adding revenue');
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400);
    throw new Error('Select at least one branch and enter an amount');
  }

  const tender = paymentType || paymentMethod;
  const finalPaymentType = PAYMENT_METHODS.includes(tender) ? tender : 'CASH';
  const finalTitle = String(title || '').trim() || 'Manual Revenue';
  const finalCategory = String(category || '').trim() || 'Manual';
  const when = date ? new Date(date) : new Date();

  // Validate + normalize EVERY entry before writing anything (all-or-nothing): one
  // bad branch or amount rejects the whole batch, so no partial post slips through.
  const seen = new Set();
  const normalized = [];
  for (const [idx, entry] of entries.entries()) {
    const locId = entry && (entry.locationId || entry.location);
    const amt = Number(entry && entry.amount);
    if (!locId || !mongoose.Types.ObjectId.isValid(String(locId))) {
      res.status(400);
      throw new Error(`Invalid branch selected for entry ${idx + 1}`);
    }
    if (seen.has(String(locId))) {
      res.status(400);
      throw new Error('Each branch can appear only once');
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      res.status(400);
      throw new Error('Amount for each selected branch must be a positive number');
    }
    enforceLocationAccess(req, res, locId, 'You do not have permission to add revenue for one of the selected branches');
    seen.add(String(locId));
    normalized.push({ locationId: String(locId), amount: amt });
  }

  // A branch admin may only post across branches that all belong to one admin.
  if (req.user.role === 'branch_admin' && normalized.length > 1) {
    await assertBranchesUnderOneAdmin(normalized.map((n) => n.locationId));
  }

  // Admins (and super_admin) post directly as approved; anyone else granted
  // revenue.add lands as pending so an approver signs off (segregation of duties).
  const autoApprove = ['super_admin', 'admin', 'branch_admin'].includes(req.user.role);
  const status = autoApprove ? 'approved' : 'pending';

  const docs = normalized.map((n) => ({
    type: 'MANUAL_REVENUE',
    totalAmount: n.amount,
    totalProfit: n.amount, // revenue carries no cost basis here
    paymentType: finalPaymentType,
    title: finalTitle,
    category: finalCategory,
    reason: finalReason,
    description: description || undefined,
    locationId: n.locationId,
    date: when,
    createdBy: req.user._id,
    approvedBy: status === 'approved' ? req.user._id : undefined,
    status,
  }));

  const created = await Transaction.insertMany(docs);

  // If it needs approval, notify the approvers for the affected branches.
  if (status === 'pending') {
    const branchIds = [...seen];
    const admins = await User.find({
      $or: [
        { role: 'super_admin' },
        { role: 'admin', accessibleLocations: { $in: branchIds } },
        { role: 'branch_admin', $or: [{ assignedLocation: { $in: branchIds } }, { accessibleLocations: { $in: branchIds } }] },
      ],
    }).select('_id');

    if (admins.length > 0) {
      const label = created.length === 1 ? 'entry' : 'entries';
      await Notification.create({
        title: 'New Revenue Entry',
        message: `${req.user.name} (${req.user.role}) submitted ${created.length} revenue ${label} for approval.`,
        type: 'expense', // shared financial bucket (no dedicated 'revenue' type)
        sender: req.user._id,
        recipients: admins.map((a) => ({ user: a._id })),
      });
    }
  }

  const totalAmount = normalized.reduce((a, n) => a + n.amount, 0);
  res.status(201).json({
    success: true,
    count: created.length,
    status,
    totalAmount,
    data: created,
  });
});

// @desc    Approve a pending transaction
// @route   PATCH /api/transactions/:id/approve
// @access  Private (Admin/Branch Admin)
const approveTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id)
    .populate('createdBy', 'name role')
    .populate('locationId', 'name');

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction record not found');
  }

  // Segregation of duties: you cannot approve a transaction you created.
  const creatorId = (transaction.createdBy?._id || transaction.createdBy)?.toString();
  if (creatorId && creatorId === req.user._id.toString()) {
    res.status(403);
    throw new Error('You cannot approve a transaction you created');
  }

  // IDOR Mitigation: anyone except super_admin (including a user granted
  // 'revenue.approve') may only approve transactions within their own branch scope.
  const transactionLocationId = transaction.locationId?._id || transaction.locationId;
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, transactionLocationId)) {
    res.status(403);
    throw new Error('You do not have permission to approve transactions for this branch');
  }

  if (transaction.status !== 'pending') {
    res.status(400);
    throw new Error('Only pending transactions can be approved');
  }

  transaction.status = 'approved';
  transaction.approvedBy = req.user._id;
  await transaction.save();

  if (transaction.type === 'EXPENSE' && transaction.paymentType === 'CASH') emitCashUpdate(transactionLocationId);

  // NOTIFICATION LOGIC
  const approvalLocationId = transactionLocationId;
  const admins = await User.find({
    _id: { $ne: req.user._id },
    $or: [
      { role: 'super_admin' },
      { role: 'admin', accessibleLocations: approvalLocationId },
        { role: 'branch_admin', $or: [{ assignedLocation: approvalLocationId }, { accessibleLocations: approvalLocationId }] }
    ]
  });

  if (admins.length > 0) {
    await Notification.create({
      title: 'Expense Approved',
      message: `${req.user.name} (${req.user.role}) approved an expense of ₹${transaction.totalAmount} from ${transaction.createdBy?.name || 'User'} (${transaction.locationId?.name || 'Main Branch'})`,
      type: 'expense',
      sender: req.user._id,
      locationTarget: transaction.locationId?._id || null,
      recipients: admins.map(admin => ({ user: admin._id }))
    });
  }

  res.json({
    success: true,
    data: transaction
  });
});

// @desc    Reject a pending transaction
// @route   PATCH /api/transactions/:id/reject
// @access  Private (Admin/Branch Admin)
const rejectTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction record not found');
  }

  // Segregation of duties: you cannot reject a transaction you created.
  const creatorId = (transaction.createdBy?._id || transaction.createdBy)?.toString();
  if (creatorId && creatorId === req.user._id.toString()) {
    res.status(403);
    throw new Error('You cannot reject a transaction you created');
  }

  // IDOR Mitigation: anyone except super_admin (including a 'revenue.approve'
  // grantee) may only reject transactions within their own branch scope.
  const transactionLocationId = transaction.locationId?._id || transaction.locationId;
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, transactionLocationId)) {
    res.status(403);
    throw new Error('You do not have permission to reject transactions for this branch');
  }

  if (transaction.status !== 'pending') {
    res.status(400);
    throw new Error('Only pending transactions can be rejected');
  }

  transaction.status = 'rejected';
  await transaction.save();

  if (transaction.type === 'EXPENSE' && transaction.paymentType === 'CASH') emitCashUpdate(transactionLocationId);

  // NOTIFICATION LOGIC
  const rejectionLocationId = transaction.locationId?._id || transaction.locationId;
  const admins = await User.find({
    _id: { $ne: req.user._id },
    $or: [
      { role: 'super_admin' },
      { role: 'admin', accessibleLocations: rejectionLocationId },
        { role: 'branch_admin', $or: [{ assignedLocation: rejectionLocationId }, { accessibleLocations: rejectionLocationId }] }
    ]
  });

  if (admins.length > 0) {
    // Populate for message context
    const populated = await Transaction.findById(transaction._id)
      .populate('createdBy', 'name')
      .populate('locationId', 'name');

    await Notification.create({
      title: 'Expense Rejected',
      message: `${req.user.name} (${req.user.role}) rejected an expense of ₹${transaction.totalAmount} from ${populated.createdBy?.name || 'User'} (${populated.locationId?.name || 'Main Branch'})`,
      type: 'expense',
      sender: req.user._id,
      locationTarget: transaction.locationId?._id || transaction.locationId,
      recipients: admins.map(admin => ({ user: admin._id }))
    });
  }

  res.json({
    success: true,
    data: transaction
  });
});

// @desc    Get transaction analytics
// @route   GET /api/transactions/stats
// @access  Private
const getTransactionStats = asyncHandler(async (req, res) => {
  const { locationId, startDate, endDate } = req.query;

  const query = { status: 'approved' }; // ONLY approved transactions in stats
  
  // RBAC Enforcement
  if (req.user.role === 'branch_admin' || req.user.role === 'location_admin' || req.user.role === 'staff' || req.user.role === 'chef') {
    const ids = req.user.role === 'branch_admin'
      ? userLocationIds(req.user)
      : userLocationIds(req.user).slice(0, 1);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'User has no assigned location' });
    }
    if (locationId && locationId !== 'all') {
      if (!canAccessLocation(req.user, locationId)) return res.status(403).json({ success: false, message: 'Permission denied' });
      query.locationId = new mongoose.Types.ObjectId(locationId);
    } else {
      query.locationId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }
  } else if (req.user.role === 'admin') {
    const allowed = (req.user.accessibleLocations || []).map(id => id.toString());
    if (locationId && locationId !== 'all') {
      if (!allowed.includes(locationId)) return res.status(403).json({ success: false, message: 'Permission denied' });
      query.locationId = new mongoose.Types.ObjectId(locationId);
    } else {
      query.locationId = { $in: allowed.map(id => new mongoose.Types.ObjectId(id)) };
    }
  } else if (locationId && locationId !== 'all' && mongoose.Types.ObjectId.isValid(locationId)) {
    query.locationId = new mongoose.Types.ObjectId(locationId);
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const stats = await Transaction.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$totalProfit' },
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: stats
  });
});

module.exports = {
  getTransactions,
  createTransaction,
  splitTransaction,
  createBulkRevenue,
  getTransactionStats,
  approveTransaction,
  rejectTransaction
};
