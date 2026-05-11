const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { enforceLocationAccess, canAccessLocation, escapeRegex, clampLimit } = require('../utils/accessControl');

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
          { accessibleLocations: { $in: allowedLocs } } // If an admin has permission for another admin's location
        ]
      }
    ];
  } else if (req.user.role === 'super_admin') {
    query.role = { $in: ['admin', 'branch_admin', 'staff', 'chef'] };
  }

  // Search functionality
  if (req.query.search) {
    const searchRegex = new RegExp(escapeRegex(req.query.search), 'i');
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

  if (req.query.locationId) {
    // Only apply location filter if user has permission for it
    if (req.user.role === 'super_admin') {
      query.assignedLocation = req.query.locationId;
    } else if (req.user.role === 'admin') {
      const isAccessible = req.user.accessibleLocations?.some(
        loc => loc.toString() === req.query.locationId
      );
      if (isAccessible) {
        query.assignedLocation = req.query.locationId;
      }
    }
  }

  // Status Filter (Blocked/Active)
  if (req.query.status) {
    if (req.query.status === 'blocked') {
      query.isBlocked = true;
    } else if (req.query.status === 'active') {
      query.isBlocked = false;
      query.active = { $ne: false };
    }
  }

  // Salary Range Filter
  if (req.query.salaryRange) {
    const [min, max] = req.query.salaryRange.split('-').map(Number);
    if (!isNaN(min) && !isNaN(max)) {
      query.monthlySalary = { $gte: min, $lte: max };
    }
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 10);
  const startIndex = (page - 1) * limit;
  const total = await User.countDocuments(query);

  const users = await User.find(query)
    .select('-password')
    .populate('assignedLocation', 'name city')
    .populate('accessibleLocations', 'name city')
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limit)
    .lean();

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

  if (req.user.role !== 'super_admin' && user.assignedLocation) {
    enforceLocationAccess(req, res, user.assignedLocation, 'You do not have permission to promote this user');
  }

  // Hierarchy logic
  if (req.user.role === 'admin' && (user.role === 'admin' || user.role === 'super_admin')) {
    res.status(403);
    throw new Error('You do not have permission to promote this user');
  }

  const oldRole = user.role;
  let nextRole = user.role;
  if (user.role === 'staff') nextRole = 'branch_admin';
  else if (user.role === 'branch_admin') nextRole = 'admin';
  else if (user.role === 'admin') nextRole = 'super_admin';

  user.role = nextRole;
  await user.save();

  const { logSecurityAction } = require('../utils/auditLogger');
  await logSecurityAction(req, 'USER_PROMOTED', { oldRole, newRole: nextRole }, user._id, 'User');

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

  if (req.user.role !== 'super_admin' && user.assignedLocation) {
    enforceLocationAccess(req, res, user.assignedLocation, 'You do not have permission to demote this user');
  }

  if (req.user.role === 'admin' && (user.role === 'admin' || user.role === 'super_admin')) {
    res.status(403);
    throw new Error('You do not have permission to demote this user');
  }

  const oldRole = user.role;
  let prevRole = user.role;
  if (user.role === 'admin') prevRole = 'branch_admin';
  else if (user.role === 'branch_admin') prevRole = 'staff';

  user.role = prevRole;
  await user.save();

  const { logSecurityAction } = require('../utils/auditLogger');
  await logSecurityAction(req, 'USER_DEMOTED', { oldRole, newRole: prevRole }, user._id, 'User');

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
    throw new Error('You do not have permission to update users from other locations');
  }

  if (req.user.role === 'admin' && user.assignedLocation && !canAccessLocation(req.user, user.assignedLocation)) {
    res.status(403);
    throw new Error('You do not have permission to update users from other locations');
  }

  // Fields allowed to be updated by admins via this route
  const updatableFields = [
    'name', 'email', 'phone', 'assignedLocation', 'accessibleLocations', 
    'active', 'gender', 'age', 'address1', 'city', 'state', 'country', 
    'pincode', 'aadharNumber', 'highestQualification', 'monthlySalary'
  ];
  const updateData = {};
  
  updatableFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  // Only Super Admin can change roles to 'admin' or 'super_admin'
  if (req.body.role) {
    if (req.user.role === 'super_admin') {
      updateData.role = req.body.role;
    } else if (req.user.role === 'admin' && !['admin', 'super_admin'].includes(req.body.role)) {
      updateData.role = req.body.role;
    }
  }

  if (updateData.assignedLocation && req.user.role !== 'super_admin') {
    enforceLocationAccess(req, res, updateData.assignedLocation, 'You do not have permission to assign this location');
  }

  // Branch Transfer Guard: Prevent transfer if active orders exist
  if (updateData.assignedLocation && updateData.assignedLocation.toString() !== user.assignedLocation?.toString()) {
    const Order = require('../models/Order');
    const activeOrders = await Order.findOne({
      $or: [{ assignedChef: user._id }, { createdBy: user._id }],
      status: { $nin: ['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'] }
    });

    if (activeOrders) {
      res.status(400);
      throw new Error(`Cannot transfer user "${user.name}" while they have active orders assigned to them.`);
    }
  }

  const updatedUser = await User.findByIdAndUpdate(req.params.id, { $set: updateData }, {
    new: true,
    runValidators: true,
  }).select('-password');

  const { logSecurityAction } = require('../utils/auditLogger');
  await logSecurityAction(req, 'USER_UPDATED', { changedFields: Object.keys(updateData) }, user._id, 'User');

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
  if (req.user.role === 'branch_admin') {
    if (user.assignedLocation?.toString() !== req.user.assignedLocation?.toString()) {
      res.status(403);
      throw new Error('You do not have permission to delete users from other locations');
    }
    if (!['staff', 'chef'].includes(user.role)) {
      res.status(403);
      throw new Error('Branch Admins can only delete Staff or Chef personnel');
    }
  }

  if (req.user.role === 'admin' && user.assignedLocation && !canAccessLocation(req.user, user.assignedLocation)) {
    res.status(403);
    throw new Error('You do not have permission to delete users from other locations');
  }

  if (user.role === 'super_admin') {
    res.status(403);
    throw new Error('Super Admin cannot be deleted');
  }

  // Active Order Guard for Deletion
  const Order = require('../models/Order');
  const activeOrders = await Order.findOne({
    $or: [{ assignedChef: user._id }, { createdBy: user._id }],
    status: { $nin: ['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'] }
  });

  if (activeOrders) {
    res.status(400);
    throw new Error(`Cannot delete user "${user.name}" with active pending orders.`);
  }

  const userId = user._id;
  const userName = user.name;
  const locationId = user.assignedLocation;

  await user.deleteOne();

  const { logSecurityAction } = require('../utils/auditLogger');
  await logSecurityAction(req, 'USER_DELETED', { userName }, userId, 'User');

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

  // Location restriction
  if (req.user.role !== 'super_admin' && user.assignedLocation && !canAccessLocation(req.user, user.assignedLocation)) {
    res.status(403);
    throw new Error('You do not have permission to view users from other locations');
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
    message: `Staff Details for ${user.name} was updated by the owner.`,
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

  if (newPassword.length < 10) {
    res.status(400);
    throw new Error('New password must be at least 10 characters');
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

// @desc    Update user permissions
// @route   PUT /api/users/:id/permissions
// @access  Private (Super Admin, Admin, Branch Admin)
const updateUserPermissions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Hierarchy Authorization Rules
  // SUPER_ADMIN > ADMIN > BRANCH_ADMIN > LOCATION_ADMIN > STAFF/CHEF
  // Super Admin -> Admin
  // Admin -> Branch Admin / Location Admin
  // Branch Admin -> Staff / Chef
  
  const actorRole = req.user.role;
  const targetRole = user.role;

  if (actorRole !== 'super_admin' && user.assignedLocation && !canAccessLocation(req.user, user.assignedLocation)) {
    res.status(403);
    throw new Error('You do not have permission to modify permissions outside your locations');
  }

  let isAuthorized = false;

  if (actorRole === 'super_admin') {
    isAuthorized = true;
  } else if (actorRole === 'admin') {
    if (['branch_admin', 'location_admin', 'staff', 'chef'].includes(targetRole)) {
      isAuthorized = true;
    }
  } else if (actorRole === 'branch_admin' && (targetRole === 'staff' || targetRole === 'chef')) {
    if (user.assignedLocation?.toString() === req.user.assignedLocation?.toString()) {
      isAuthorized = true;
    } else {
      res.status(403);
      throw new Error('You can only modify permissions for staff within your own branch');
    }
  }

  if (!isAuthorized) {
    res.status(403);
    throw new Error(`As a ${actorRole}, you cannot assign permissions to a ${targetRole}`);
  }

  // Superior cannot assign permissions above own level
  if (actorRole !== 'super_admin') {
    const actorPermissions = req.user.permissions || {};
    const requestedPermissions = req.body.permissions || {};
    
    for (const key in requestedPermissions) {
      if (requestedPermissions[key] === true && !actorPermissions[key]) {
        res.status(403);
        throw new Error(`You cannot assign the permission '${key}' because you do not have it`);
      }
    }
  }

  user.permissions = req.body.permissions;
  await user.save();

  res.json({
    success: true,
    message: 'Permissions updated successfully',
    data: user.permissions
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
  updateUserPermissions,
};
