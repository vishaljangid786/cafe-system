const Expense = require('../models/Expense');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { logAction } = require('../utils/auditLogger');
const { enforceLocationAccess, escapeRegex, clampLimit, scopedLocationId } = require('../utils/accessControl');
const TransactionService = require('../services/transactionService');

// @desc    Add an expense
// @route   POST /api/expenses
// @access  Private
const addExpense = asyncHandler(async (req, res) => {
  let { title, description, amount, date, locationId, category } = req.body;

  // Auto-assign locationId for branch admins/staff
  if (!locationId && (req.user.role === 'branch_admin' || req.user.role === 'staff')) {
    locationId = req.user.assignedLocation;
  }

  if (!locationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  enforceLocationAccess(req, res, locationId, 'You do not have permission to create expenses for this location');

  // Map category to description if description is empty
  if (!description && category) {
    description = category;
  }

  if (!description) description = 'No description';

  let proofImage = '';
  if (req.file) {
    proofImage = req.file.path; // Cloudinary URL
  } else {
    res.status(400);
    throw new Error('Proof image (receipt) is required');
  }

  const expense = await Expense.create({
    title,
    description,
    amount,
    category: category || 'misc',
    date: date || Date.now(),
    locationId,
    createdBy: req.user._id,
    proofImage,
    status: req.user.role === 'super_admin' ? 'approved' : 'pending'
  });

  // Sync to Transaction Ledger
  await TransactionService.syncExpenseToTransaction(expense);

  await sendNotification({
    title: 'New Expense Added',
    message: `Expense "${expense.title}" of amount ${expense.amount} added by ${req.user.name}.`,
    type: 'expense',
    performedByUser: req.user,
    locationId: expense.locationId,
  });

  await logAction(req, 'EXPENSE_ADD', `Added expense: ${expense.title} (₹${expense.amount})`);

  res.status(201).json({
    success: true,
    data: expense,
  });
});

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = asyncHandler(async (req, res) => {
  let expense = await Expense.findById(req.params.id);

  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }

  enforceLocationAccess(req, res, expense.locationId, 'You do not have permission to update this expense');

  const allowedUpdates = ['title', 'description', 'amount', 'date', 'category'];
  const updateData = {};
  
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  if (req.file) {
    updateData.proofImage = req.file.path;
  }

  expense = await Expense.findByIdAndUpdate(req.params.id, { $set: updateData }, {
    new: true,
    runValidators: true,
  });

  // Sync to Transaction Ledger
  await TransactionService.syncExpenseToTransaction(expense);

  await sendNotification({
    title: 'Expense Updated',
    message: `Expense "${expense.title}" was updated by ${req.user.name}.`,
    type: 'expense',
    performedByUser: req.user,
    locationId: expense.locationId,
  });

  await logAction(req, 'EXPENSE_UPDATE', `Updated expense: ${expense.title}`);

  res.json({
    success: true,
    data: expense,
  });
});

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }

  enforceLocationAccess(req, res, expense.locationId, 'You do not have permission to delete this expense');

  await expense.deleteOne();
  await TransactionService.deleteExpenseTransaction(expense._id);

  await sendNotification({
    title: 'Expense Deleted',
    message: `Expense "${expense.title}" was deleted by ${req.user.name}.`,
    type: 'expense',
    performedByUser: req.user,
    locationId: expense.locationId,
  });

  await logAction(req, 'EXPENSE_DELETE', `Deleted expense: ${expense.title}`);

  res.json({
    success: true,
    message: 'Expense removed',
  });
});

// @desc    Get all expenses (with location filtering, search, pagination)
// @route   GET /api/expenses
// @access  Private
const getExpenses = asyncHandler(async (req, res) => {
  let query = {};

  const branchScope = scopedLocationId(req, req.query.locationId);
  if (branchScope) query.locationId = branchScope;

  // If chef, they can only see expenses created by them
  if (req.user.role === 'chef') {
    query.createdBy = req.user._id;
  }

  // Search by title or category
  if (req.query.search) {
    const searchRegex = new RegExp(escapeRegex(req.query.search), 'i');
    query.$or = [
      { title: searchRegex },
      { category: searchRegex }
    ];
  }

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by category
  if (req.query.category) {
    query.category = req.query.category;
  }

  // Date Filtering
  if (req.query.startDate || req.query.endDate) {
    query.date = {};
    if (req.query.startDate) {
      query.date.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const startIndex = (page - 1) * limit;

  const total = await Expense.countDocuments(query);

  const expenses = await Expense.find(query)
    .sort({ date: -1 })
    .skip(startIndex)
    .limit(limit)
    .populate('createdBy', 'name email')
    .populate('locationId', 'name')
    .lean();

  res.json({
    success: true,
    count: expenses.length,
    total,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      itemsPerPage: limit
    },
    data: expenses.map(exp => ({
      ...exp,
      locationName: exp.locationId?.name || 'Unknown'
    })),
  });
});

// @desc    Update expense status (approve/reject)
// @route   PATCH /api/expenses/:id/status
// @access  Private (Admin/Branch Admin)
const updateExpenseStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!['approved', 'rejected', 'completed'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status');
  }

  let expense = await Expense.findById(req.params.id);

  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }

  enforceLocationAccess(req, res, expense.locationId, 'You do not have permission to update this expense');

  expense.status = status;
  await expense.save();

  // Sync to Transaction Ledger
  await TransactionService.syncExpenseToTransaction(expense);

  await sendNotification({
    title: `Expense ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: `Expense "${expense.title}" was ${status} by ${req.user.name}.`,
    type: 'expense',
    performedByUser: req.user,
    locationId: expense.locationId,
  });

  await logAction(req, 'EXPENSE_STATUS_UPDATE', `Updated expense status to ${status}: ${expense.title}`);

  res.json({
    success: true,
    data: expense,
  });
});

module.exports = {
  addExpense,
  updateExpense,
  deleteExpense,
  getExpenses,
  updateExpenseStatus,
};
