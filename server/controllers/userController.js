const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin, Super Admin, Branch Admin)
const getUsers = asyncHandler(async (req, res) => {
  let query = {};

  // Branch Admin can only see staff from their branch
  if (req.user.role === 'branch_admin') {
    query.branchName = req.user.branchName;
  }

  const users = await User.find(query).select('-password');

  res.json({
    success: true,
    count: users.length,
    data: users,
  });
});

// @desc    Promote user to next role
// @route   PATCH /api/users/:id/promote
// @access  Private (Super Admin, Admin)
const promoteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Hierarchy logic
  if (req.user.role === 'admin' && (user.role === 'admin' || user.role === 'super_admin')) {
    res.status(403);
    throw new Error('Not authorized to promote this user');
  }

  let nextRole = user.role;
  if (user.role === 'staff') nextRole = 'branch_admin';
  else if (user.role === 'branch_admin') nextRole = 'admin';
  else if (user.role === 'admin') nextRole = 'super_admin';

  user.role = nextRole;
  await user.save();

  await sendNotification({
    title: 'User Promoted',
    message: `User ${user.name} promoted to ${nextRole} by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    branchName: user.branchName,
  });

  res.json({ success: true, message: `User promoted to ${nextRole}`, data: user });
});

// @desc    Demote user to previous role
// @route   PATCH /api/users/:id/demote
// @access  Private (Super Admin, Admin)
const demoteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (req.user.role === 'admin' && (user.role === 'admin' || user.role === 'super_admin')) {
    res.status(403);
    throw new Error('Not authorized to demote this user');
  }

  let prevRole = user.role;
  if (user.role === 'admin') prevRole = 'branch_admin';
  else if (user.role === 'branch_admin') prevRole = 'staff';

  user.role = prevRole;
  await user.save();

  await sendNotification({
    title: 'User Demoted',
    message: `User ${user.name} demoted to ${prevRole} by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    branchName: user.branchName,
  });

  res.json({ success: true, message: `User demoted to ${prevRole}`, data: user });
});

// @desc    Replace user with another user (e.g. transfer duties)
// @route   POST /api/users/replace
// @access  Private (Super Admin, Admin)
const replaceUser = asyncHandler(async (req, res) => {
  const { oldUserId, newUserId } = req.body;

  const oldUser = await User.findById(oldUserId);
  const newUser = await User.findById(newUserId);

  if (!oldUser || !newUser) {
    res.status(404);
    throw new Error('One or both users not found');
  }

  // Admins restrictions apply here too if needed...
  
  // Example logic: deactivate old user, ensure new user has correct role/branch
  oldUser.role = 'staff'; // demote or deactivate
  // Update new user
  newUser.role = oldUser.role;
  newUser.branchName = oldUser.branchName;

  await oldUser.save();
  await newUser.save();

  await sendNotification({
    title: 'User Replaced',
    message: `User ${oldUser.name} was replaced by ${newUser.name} by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    branchName: newUser.branchName,
  });

  res.json({
    success: true,
    message: 'User replaced successfully',
  });
});

// @desc    Update user details
// @route   PUT /api/users/:id
// @access  Private (Super Admin, Admin, Branch Admin)
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Branch Admin can only update staff from their branch
  if (req.user.role === 'branch_admin' && user.branchName !== req.user.branchName) {
    res.status(403);
    throw new Error('Not authorized to update users from other branches');
  }

  // Prevent branch admin from changing roles to anything higher than staff
  if (req.user.role === 'branch_admin' && req.body.role && req.body.role !== 'staff') {
    delete req.body.role;
  }

  const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).select('-password');

  res.json({
    success: true,
    data: updatedUser,
  });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Super Admin, Admin, Branch Admin)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Restrictions
  if (req.user.role === 'branch_admin' && user.branchName !== req.user.branchName) {
    res.status(403);
    throw new Error('Not authorized to delete users from other branches');
  }

  if (user.role === 'super_admin') {
    res.status(403);
    throw new Error('Super Admin cannot be deleted');
  }

  await user.deleteOne();

  await sendNotification({
    title: 'User Deleted',
    message: `User ${user.name} was removed by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    branchName: user.branchName,
  });

  res.json({
    success: true,
    message: 'User removed successfully',
  });
});

// @desc    Toggle blocklist status
// @route   PUT /api/users/:id/block
// @access  Private (Super Admin, Admin)
const toggleBlocklist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.role === 'super_admin') {
    res.status(403);
    throw new Error('Cannot block Super Admin');
  }

  user.isBlocked = !user.isBlocked;
  await user.save();

  res.json({
    success: true,
    message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
    data: { isBlocked: user.isBlocked },
  });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin, Super Admin, Branch Admin)
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Branch Admin restriction
  if (req.user.role === 'branch_admin' && user.branchName !== req.user.branchName) {
    res.status(403);
    throw new Error('Not authorized to view users from other branches');
  }

  res.json({
    success: true,
    data: user,
  });
});

module.exports = {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  promoteUser,
  demoteUser,
  toggleBlocklist,
  replaceUser,
};
