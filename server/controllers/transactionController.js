const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { enforceLocationAccess, escapeRegex, clampLimit } = require('../utils/accessControl');

// @desc    Get all transactions (unified ledger with search, filters, pagination, RBAC)
// @route   GET /api/transactions
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const { type, locationId, startDate, endDate, category, myExpenses, status, search, minAmount, maxAmount } = req.query;

  const query = {};

  if (type) query.type = type;
  if (category) query.category = category;
  if (status) query.status = status;

  // STRICT RBAC
  if (req.user.role === 'super_admin') {
    if (locationId && locationId !== 'all') {
      query.locationId = locationId;
    }
  } else if (req.user.role === 'admin') {
    if (locationId && locationId !== 'all') {
      const isAccessible = req.user.accessibleLocations?.some(
        loc => loc.toString() === locationId
      );
      if (!isAccessible) {
        return res.status(403).json({ success: false, message: 'Access denied to this location' });
      }
      query.locationId = locationId;
    } else {
      query.locationId = { $in: req.user.accessibleLocations || [] };
    }
  } else {
    // Branch Admin, Chef, Staff
    query.locationId = req.user.assignedLocation;
  }

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

  let targetLocation = locationId;
  if (['branch_admin', 'staff', 'chef'].includes(req.user.role)) {
    targetLocation = req.user.assignedLocation;
  }

  if (!targetLocation) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  enforceLocationAccess(req, res, targetLocation, 'Not authorized to create transactions for this location');

  // Handle billImage if uploaded (assuming multer is used in routes)
  const billImage = req.file ? req.file.path : undefined;

  // Determine initial status - explicitly check role string
  let status = 'approved';
  if (['staff', 'chef'].includes(req.user.role) && type === 'expense') {
    status = 'pending';
  }

  const transaction = await Transaction.create({
    type,
    totalAmount: amount,
    totalProfit: type === 'MANUAL_REVENUE' ? amount : -amount, // Expense reduces total profit
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
      role: { $in: ['super_admin', 'admin', 'branch_admin'] },
      assignedLocation: targetLocation
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

  // IDOR Mitigation: Branch Admin can only approve transactions for their own branch
  if (req.user.role === 'branch_admin' && transaction.locationId?.toString() !== req.user.assignedLocation?.toString()) {
    res.status(403);
    throw new Error('Not authorized to approve transactions for another branch');
  }

  // Admin: Only if they have access to this location
  if (req.user.role === 'admin' && !req.user.accessibleLocations?.some(loc => loc.toString() === transaction.locationId?.toString())) {
    res.status(403);
    throw new Error('Not authorized to approve transactions for this branch');
  }

  if (transaction.status !== 'pending') {
    res.status(400);
    throw new Error('Only pending transactions can be approved');
  }

  transaction.status = 'approved';
  transaction.approvedBy = req.user._id;
  await transaction.save();

  // NOTIFICATION LOGIC
  // Notify other admins about the approval as requested
  const admins = await User.find({
    role: { $in: ['super_admin', 'admin', 'branch_admin'] },
    _id: { $ne: req.user._id } // Don't notify the approver themselves
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

  // IDOR Mitigation: Branch Admin can only reject transactions for their own branch
  if (req.user.role === 'branch_admin' && transaction.locationId?.toString() !== req.user.assignedLocation?.toString()) {
    res.status(403);
    throw new Error('Not authorized to reject transactions for another branch');
  }

  // Admin: Only if they have access to this location
  if (req.user.role === 'admin' && !req.user.accessibleLocations?.some(loc => loc.toString() === transaction.locationId?.toString())) {
    res.status(403);
    throw new Error('Not authorized to reject transactions for this branch');
  }

  if (transaction.status !== 'pending') {
    res.status(400);
    throw new Error('Only pending transactions can be rejected');
  }

  transaction.status = 'rejected';
  await transaction.save();

  // NOTIFICATION LOGIC
  const admins = await User.find({
    role: { $in: ['super_admin', 'admin', 'branch_admin'] },
    _id: { $ne: req.user._id }
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
  if (req.user.role === 'branch_admin' || req.user.role === 'staff' || req.user.role === 'chef') {
    if (!req.user.assignedLocation) {
      return res.status(400).json({ success: false, message: 'User has no assigned location' });
    }
    query.locationId = new mongoose.Types.ObjectId(req.user.assignedLocation.toString());
  } else if (req.user.role === 'admin') {
    const allowed = (req.user.accessibleLocations || []).map(id => id.toString());
    if (locationId && locationId !== 'all') {
      if (!allowed.includes(locationId)) return res.status(403).json({ success: false, message: 'Access denied' });
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
