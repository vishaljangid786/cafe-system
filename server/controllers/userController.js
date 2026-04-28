const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin, Super Admin, Branch Admin)
const getUsers = asyncHandler(async (req, res) => {
  let query = {};

  // Hierarchy Visibility Logic
  if (req.user.role === 'branch_admin') {
    query.assignedLocation = req.user.assignedLocation;
    query.role = { $in: ['staff', 'chef'] };
  } else if (req.user.role === 'admin') {
    // Admins see branch admins and staff under their accessible locations
    const allowedLocs = (req.user.accessibleLocations || []).map(id => id.toString());
    query.$and = [
      { role: { $in: ['branch_admin', 'staff', 'chef'] } },
      { 
        $or: [
          { assignedLocation: { $in: allowedLocs } },
          { accessibleLocations: { $in: allowedLocs } } // If an admin has access to another admin's location
        ]
      }
    ];
  } else if (req.user.role === 'super_admin') {
    query.role = { $in: ['admin', 'branch_admin', 'staff', 'chef'] };
  }

  // Search functionality
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { role: searchRegex }
    ];
  }

  // Optional Filters
  if (req.query.role && req.user.role !== 'branch_admin') {
    const viewableRoles = req.user.role === 'super_admin'
      ? ['admin', 'branch_admin', 'staff', 'chef']
      : ['branch_admin', 'staff', 'chef'];

    if (viewableRoles.includes(req.query.role)) {
      query.role = req.query.role;
    }
  }

  if (req.query.locationId && req.user.role !== 'branch_admin') {
    query.assignedLocation = req.query.locationId;
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const total = await User.countDocuments(query);

  const users = await User.find(query)
    .select('-password')
    .populate('assignedLocation', 'name city')
    .populate('accessibleLocations', 'name city')
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limit);

  res.json({
    success: true,
    count: users.length,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
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
    locationId: user.assignedLocation,
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
    locationId: user.assignedLocation,
  });

  res.json({ success: true, message: `User demoted to ${prevRole}`, data: user });
});

// @desc    Update user details
// @route   PUT /api/users/:id
// @access  Private (Super Admin, Admin, Location Admin)
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Location Admin can only update staff from their location
  if (req.user.role === 'branch_admin' && user.assignedLocation?.toString() !== req.user.assignedLocation?.toString()) {
    res.status(403);
    throw new Error('Not authorized to update users from other locations');
  }

  // Prevent location admin from changing roles to anything higher than staff
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
// @access  Private (Super Admin, Admin, Location Admin)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Restrictions
  if (req.user.role === 'branch_admin' && user.assignedLocation?.toString() !== req.user.assignedLocation?.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete users from other locations');
  }

  if (user.role === 'super_admin') {
    res.status(403);
    throw new Error('Super Admin cannot be deleted');
  }

  const userId = user._id;
  const userName = user.name;
  const locationId = user.assignedLocation;

  await user.deleteOne();

  await sendNotification({
    title: 'User Deleted',
    message: `User ${userName} was removed by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    locationId,
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
// @access  Private (Admin, Super Admin, Location Admin)
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password').populate('assignedLocation', 'name city');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Location Admin restriction
  if (req.user.role === 'branch_admin' && user.assignedLocation?._id.toString() !== req.user.assignedLocation?.toString()) {
    res.status(403);
    throw new Error('Not authorized to view users from other locations');
  }

  res.json({
    success: true,
    data: user,
  });
});

// @desc    Update current user profile
// @route   PUT /api/users/update-profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Fields allowed to be updated by user themselves
  const allowedFields = [
    'name',
    'phone',
    'age',
    'gender',
    'address1',
    'address2',
    'city',
    'state',
    'country',
    'pincode',
    'alternatePhone',
    'highestQualification'
  ];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      user[field] = req.body[field];
    }
  });

  // Handle profile image if uploaded
  if (req.file) {
    user.profileImageUrl = req.file.path;
  }

  const updatedUser = await user.save();

  await sendNotification({
    title: 'Profile Updated',
    message: `Personnel Details for ${user.name} was updated by the owner.`,
    type: 'user_action',
    performedByUser: req.user,
    locationId: user.assignedLocation,
  });

  res.json({
    success: true,
    data: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      profileImageUrl: updatedUser.profileImageUrl,
      assignedLocation: updatedUser.assignedLocation,
    },
  });
});

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Please provide current and new password');
  }

  const user = await User.findById(req.user._id);

  if (!user || !(await user.matchPassword(currentPassword))) {
    res.status(401);
    throw new Error('Invalid current password');
  }

  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password updated successfully',
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
  updateProfile,
  changePassword,
};
