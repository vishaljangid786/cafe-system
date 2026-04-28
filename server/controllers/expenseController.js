const Expense = require('../models/Expense');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { logAction } = require('../utils/auditLogger');

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

  await expense.deleteOne();

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

  // STRICT RBAC
  if (req.user.role === 'super_admin') {
    // Can see everything, but respect query filter if provided
    if (req.query.locationId) {
      query.locationId = req.query.locationId;
    }
  } else if (req.user.role === 'admin') {
    // Admins can only see expenses from their accessible locations
    if (req.query.locationId) {
      // Validate requested location is in accessible locations
      const isAccessible = req.user.accessibleLocations?.some(
        loc => loc.toString() === req.query.locationId
      );
      if (!isAccessible) {
        return res.status(403).json({ success: false, message: 'Access denied to this location' });
      }
      query.locationId = req.query.locationId;
    } else {
      query.locationId = { $in: req.user.accessibleLocations || [] };
    }
  } else {
    // Branch Admin, Chef, Staff
    query.locationId = req.user.assignedLocation;
  }

  // If chef, they can only see expenses created by them
  if (req.user.role === 'chef') {
    query.createdBy = req.user._id;
  }

  // Search by title or category
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
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
  const limit = parseInt(req.query.limit, 10) || 20;
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

module.exports = {
  addExpense,
  updateExpense,
  deleteExpense,
  getExpenses,
};
