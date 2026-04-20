const Expense = require('../models/Expense');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');

// @desc    Add an expense
// @route   POST /api/expenses
// @access  Private
const addExpense = asyncHandler(async (req, res) => {
  let { title, description, amount, date, locationId, category } = req.body;

  // Auto-assign locationId for location admins/staff
  if (!locationId && (req.user.role === 'location_admin' || req.user.role === 'staff')) {
    locationId = req.user.assignedLocation;
  }

  if (!locationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

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
    date: date || Date.now(),
    locationId,
    createdBy: req.user._id,
    proofImage,
  });

  await sendNotification({
    title: 'New Expense Added',
    message: `Expense "${expense.title}" of amount ${expense.amount} added by ${req.user.name}.`,
    type: 'expense',
    performedByUser: req.user,
    locationId: expense.locationId,
  });

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

  if (req.file) {
    req.body.proofImage = req.file.path;
  }

  expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  await sendNotification({
    title: 'Expense Updated',
    message: `Expense "${expense.title}" was updated by ${req.user.name}.`,
    type: 'expense',
    performedByUser: req.user,
    locationId: expense.locationId,
  });

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

  await expense.deleteOne();

  await sendNotification({
    title: 'Expense Deleted',
    message: `Expense "${expense.title}" was deleted by ${req.user.name}.`,
    type: 'expense',
    performedByUser: req.user,
    locationId: expense.locationId,
  });

  res.json({
    success: true,
    message: 'Expense removed',
  });
});

// @desc    Get all expenses (with location filtering)
// @route   GET /api/expenses
// @access  Private
const getExpenses = asyncHandler(async (req, res) => {
  let query = {};

  if (req.query.locationId) {
    query.locationId = req.query.locationId;
  }

  // If user is location_admin, restrict to their location
  if (req.user.role === 'location_admin' || req.user.role === 'staff') {
    query.locationId = req.user.assignedLocation;
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

  const expenses = await Expense.find(query)
    .sort({ date: -1 })
    .populate('createdBy', 'name email')
    .populate('locationId', 'name');

  res.json({
    success: true,
    count: expenses.length,
    data: expenses.map(exp => ({
      ...exp._doc,
      locationName: exp.locationId?.name || 'Unknown'
    })),
  });
});

module.exports = {
  addExpense,
  updateExpense,
  deleteExpense,
  getExpenses,
};
