const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { enforceLocationAccess, canAccessLocation, escapeRegex, clampLimit, scopedLocationId, userLocationIds } = require('../utils/accessControl');

// @desc    Get all transactions (unified ledger with search, filters, pagination, RBAC)
// @route   GET /api/transactions
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const { type, locationId, startDate, endDate, category, myExpenses, status, search, minAmount, maxAmount } = req.query;

  const query = {};

  if (type) query.type = type;
  if (category) query.category = category;
  if (status) {
    query.status = status;
  } else if (['super_admin', 'admin', 'branch_admin', 'location_admin'].includes(req.user.role)) {
    // Default to approved for admins to hide pending entries from "All" view
    query.status = 'approved';
  }

  // STRICT RBAC
  const branchScope = scopedLocationId(req, locationId);
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
  const { type, amount, title, category, locationId, date, description } = req.body;

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
  // and a richer approval workflow. We deliberately do NOT delete this path, but
  // we harden it for parity: anyone WITHOUT editRevenue (and who is not an admin
  // role) must land as 'pending' so it goes through approval. Only super_admin
  // auto-approves their own entries (segregation of duties for everyone else).
  const isAdminRole = ['admin', 'branch_admin'].includes(req.user.role);
  const hasEditRevenue = !!(req.user.permissions && req.user.permissions.editRevenue);
  let status = 'pending';
  if (req.user.role === 'super_admin') {
    status = 'approved';
  } else if (!isAdminRole && !hasEditRevenue) {
    // Non-admin without editRevenue: force pending (defense-in-depth; the route
    // already requires editRevenue, but this guarantees safety if that changes).
    status = 'pending';
  }

  const transaction = await Transaction.create({
    type,
    totalAmount: numAmount,
    totalProfit: type === 'MANUAL_REVENUE' ? numAmount : -numAmount, // Expense reduces total profit
    title,
    category,
    locationId: targetLocation,
    date: date || new Date(),
    description,
    createdBy: req.user._id,
    billImage,
    status
  });

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
  getTransactionStats,
  approveTransaction,
  rejectTransaction
};
