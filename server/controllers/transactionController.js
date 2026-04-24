const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all transactions (unified ledger)
// @route   GET /api/transactions
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const { type, locationId, startDate, endDate, category } = req.query;
  
  const query = {};
  
  if (type) query.type = type;
  if (category) query.category = category;
  
  // Location scoping
  if (req.user.role === 'branch_admin' || req.user.role === 'staff') {
    query.locationId = req.user.assignedLocation;
  } else if (locationId && locationId !== 'all') {
    query.locationId = locationId;
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
    .populate('createdBy', 'name')
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
  if (req.user.role === 'branch_admin' || req.user.role === 'staff') {
    targetLocation = req.user.assignedLocation;
  }

  if (!targetLocation) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  // Handle billImage if uploaded (assuming multer is used in routes)
  const billImage = req.file ? req.file.path : undefined;

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
    billImage
  });

  res.status(201).json({
    success: true,
    data: transaction
  });
});

// @desc    Get transaction analytics
// @route   GET /api/transactions/stats
// @access  Private
const getTransactionStats = asyncHandler(async (req, res) => {
  const { locationId, startDate, endDate } = req.query;
  
  const query = {};
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
  getTransactionStats
};
