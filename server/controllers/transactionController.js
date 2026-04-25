const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all transactions (unified ledger)
// @route   GET /api/transactions
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const { type, locationId, startDate, endDate, category, myExpenses, status } = req.query;
  
  const query = {};
  
  if (type) query.type = type;
  if (category) query.category = category;

  // Default status filter
  if (status) {
    query.status = status;
  } else {
    if (!['staff', 'chef'].includes(req.user.role)) {
      // Admins/Branch Admins see all unless specified
      // query.status = 'approved'; // Removed this default restriction
    }
  }
  
  // Scope by user role and myExpenses flag
  if (req.user.role === 'staff' || req.user.role === 'chef') {
    // Staff and Chef can ONLY see their own expenses (any status)
    query.createdBy = req.user._id;
    query.locationId = req.user.assignedLocation;
  } else if (myExpenses === 'true') {
    // Admin/Branch Admin explicitly requested their own expenses
    query.createdBy = req.user._id;
    if (req.user.role === 'branch_admin') {
      query.locationId = req.user.assignedLocation;
    }
  } else {
    // "All" view
    if (req.user.role === 'branch_admin') {
      query.locationId = req.user.assignedLocation;
    } else if (locationId && locationId !== 'all') {
      query.locationId = locationId;
    }
  }

  // Date range
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const transactions = await Transaction.find(query)
    .populate('locationId', 'name city')
    .populate('staffId', 'name')
    .populate('createdBy', 'name role profileImageUrl')
    .populate('approvedBy', 'name role')
    .sort({ date: -1, createdAt: -1 });

  res.json({
    success: true,
    count: transactions.length,
    data: transactions
  });
});

// @desc    Create a manual transaction (Expense/Revenue)
// @route   POST /api/transactions
// @access  Private
const createTransaction = asyncHandler(async (req, res) => {
  const { type, amount, title, category, locationId, date, description } = req.body;

  if (!type || !['manual_revenue', 'expense'].includes(type)) {
    res.status(400);
    throw new Error('Valid transaction type (manual_revenue or expense) is required');
  }

  let targetLocation = locationId;
  if (['branch_admin', 'staff', 'chef'].includes(req.user.role)) {
    targetLocation = req.user.assignedLocation;
  }

  if (!targetLocation) {
    res.status(400);
    throw new Error('Location ID is required');
  }

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
    totalProfit: type === 'manual_revenue' ? amount : -amount, // Expense reduces total profit
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
  if (locationId && locationId !== 'all') query.locationId = locationId;
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
