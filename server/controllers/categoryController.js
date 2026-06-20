const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex } = require('../utils/accessControl');

// @desc    Get all active categories
// @route   GET /api/categories
// @access  Private
const getCategories = asyncHandler(async (req, res) => {
  const filter = { isActive: true };

  const categories = await Category.find(filter)
    .sort({ sortOrder: 1, name: 1 })
    .populate('createdBy', 'name');

  res.json({
    success: true,
    count: categories.length,
    data: categories,
  });
});

// @desc    Get all categories including inactive (admin only)
// @route   GET /api/categories/all
// @access  Private (Admin)
const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find()
    .sort({ sortOrder: 1, name: 1 })
    .populate('createdBy', 'name');

  res.json({
    success: true,
    count: categories.length,
    data: categories,
  });
});

// @desc    Create a category
// @route   POST /api/categories
// @access  Private (Admin, Location Admin)
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, sortOrder } = req.body;

  const exists = await Category.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } });
  if (exists) {
    res.status(400);
    throw new Error('Category with this name already exists');
  }

  const category = await Category.create({
    name,
    description,
    icon: icon || '🍽️',
    sortOrder: sortOrder || 0,
    createdBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private (Admin, Location Admin)
const updateCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, sortOrder, isActive } = req.body;

  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  // Check name uniqueness if being changed
  if (name && name !== category.name) {
    const exists = await Category.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      _id: { $ne: req.params.id },
    });
    if (exists) {
      res.status(400);
      throw new Error('Category with this name already exists');
    }
  }

  const updates = { name, description, icon, sortOrder };
  if (isActive !== undefined) {
    updates.isActive = isActive === 'on' || isActive === 'true' || isActive === true;
  }

  const updated = await Category.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    data: updated,
  });
});

// @desc    Delete (soft-delete) a category
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  // Soft-delete
  category.isActive = false;
  await category.save();

  res.json({
    success: true,
    message: 'Category deactivated successfully',
  });
});

module.exports = {
  getCategories,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
