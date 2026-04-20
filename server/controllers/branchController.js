const Branch = require('../models/Branch');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');

// @desc    Get all branches
// @route   GET /api/branches
// @access  Private
const getBranches = asyncHandler(async (req, res) => {
  const { status } = req.query;
  
  let query = { isPermanentlyDeleted: false };
  if (status) {
    query.status = status;
  }

  const branches = await Branch.find(query).populate('createdBy', 'name email');

  res.json({
    success: true,
    count: branches.length,
    data: branches,
  });
});

// @desc    Create a branch
// @route   POST /api/branches
// @access  Private (Admin, Super Admin)
const createBranch = asyncHandler(async (req, res) => {
  const { name, location } = req.body;

  const branchExists = await Branch.findOne({ name });
  if (branchExists) {
    res.status(400);
    throw new Error('Branch with this name already exists');
  }

  const branch = await Branch.create({
    name,
    location,
    createdBy: req.user._id,
  });

  await sendNotification({
    title: 'New Branch Created',
    message: `Branch "${branch.name}" was created by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
  });

  res.status(201).json({
    success: true,
    data: branch,
  });
});

// @desc    Update branch details or status
// @route   PATCH /api/branches/:id
// @access  Private (Admin, Super Admin)
const updateBranch = asyncHandler(async (req, res) => {
  const { name, location, status, holdReason } = req.body;

  const branch = await Branch.findById(req.params.id);

  if (!branch || branch.isPermanentlyDeleted) {
    res.status(404);
    throw new Error('Branch not found');
  }

  if (name) branch.name = name;
  if (location) branch.location = location;
  if (status) {
    branch.status = status;
    if (status === 'hold') {
      branch.holdReason = holdReason;
    } else {
      branch.holdReason = undefined;
    }
  }

  await branch.save();

  await sendNotification({
    title: 'Branch Updated',
    message: `Branch "${branch.name}" was updated by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
  });

  res.json({
    success: true,
    data: branch,
  });
});

// @desc    Soft delete a branch
// @route   DELETE /api/branches/:id
// @access  Private (Admin, Super Admin)
const softDeleteBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id);

  if (!branch || branch.isPermanentlyDeleted) {
    res.status(404);
    throw new Error('Branch not found');
  }

  branch.status = 'deleted';
  await branch.save();

  await sendNotification({
    title: 'Branch Soft Deleted',
    message: `Branch "${branch.name}" was marked as deleted by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
  });

  res.json({
    success: true,
    message: 'Branch soft deleted successfully',
  });
});

// @desc    Permanently delete a branch
// @route   DELETE /api/branches/:id/permanent
// @access  Private (Admin, Super Admin)
const hardDeleteBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id);

  if (!branch) {
    res.status(404);
    throw new Error('Branch not found');
  }

  const branchName = branch.name;
  await branch.deleteOne();

  await sendNotification({
    title: 'Branch Permanently Deleted',
    message: `Branch "${branchName}" was permanently deleted by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
  });

  res.json({
    success: true,
    message: 'Branch permanently deleted',
  });
});

module.exports = {
  getBranches,
  createBranch,
  updateBranch,
  softDeleteBranch,
  hardDeleteBranch,
};
