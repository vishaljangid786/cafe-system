const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { enforceLocationAccess, canAccessLocation, escapeRegex, clampLimit, normalizeIdList, userLocationIds, assertBranchesUnderOneAdmin } = require('../utils/accessControl');
const { encrypt } = require('../utils/encryption');

const targetUserLocations = (user) => userLocationIds(user);

const ROLE_RANK = { super_admin: 5, admin: 4, branch_admin: 3, location_admin: 2, staff: 1, chef: 1 };

const ensureCanManageUserLocation = (req, res, user, message = 'You do not have permission to manage users from other locations') => {
  if (req.user.role === 'super_admin') return;
  const ids = targetUserLocations(user);
  // A location-less target is a global account (admin / super_admin). A non-super
  // actor can't own it, so DENY rather than open-pass (this was an IDOR bypass).
  if (ids.length === 0) {
    res.status(403);
    throw new Error(message);
  }
  const hasUnauthorized = ids.some((id) => !canAccessLocation(req.user, id));
  if (hasUnauthorized) {
    res.status(403);
    throw new Error(message);
  }
};

// The actor may only manage a user STRICTLY BELOW their own role rank
// (super_admin may manage anyone). Blocks peer/superior account takeover —
// e.g. an admin disabling/deleting/blocking another admin or a super_admin.
const ensureCanManageUserRank = (req, res, user, message = 'You do not have permission to manage this user') => {
  if (req.user.role === 'super_admin') return;
  if ((ROLE_RANK[user.role] || 0) >= (ROLE_RANK[req.user.role] || 0)) {
    res.status(403);
    throw new Error(message);
  }
};

const normalizeBranchAdminUpdate = (user, updateData) => {
  const finalRole = updateData.role || user.role;
  const currentAccessible = updateData.accessibleLocations !== undefined
    ? updateData.accessibleLocations
    : user.accessibleLocations;
  const currentAssigned = updateData.assignedLocation !== undefined
    ? updateData.assignedLocation
    : user.assignedLocation;

  if (finalRole === 'branch_admin') {
    const branchIds = normalizeIdList([currentAssigned, ...normalizeIdList(currentAccessible)]);
    if (branchIds.length === 0) {
      const error = new Error('Please assign at least one branch to this Branch Admin');
      error.statusCode = 400;
      throw error;
    }
    updateData.assignedLocation = normalizeIdList(currentAssigned)[0] || branchIds[0];
    updateData.accessibleLocations = branchIds;
  } else if (['staff', 'chef', 'location_admin'].includes(finalRole)) {
    updateData.accessibleLocations = [];
  } else if (finalRole === 'admin' && updateData.assignedLocation === '') {
    delete updateData.assignedLocation;
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin, Super Admin, Branch Admin)
const getUsers = asyncHandler(async (req, res) => {
  let query = {};

  // Hierarchy Visibility Logic
  if (req.user.role === 'branch_admin') {
    query.assignedLocation = { $in: userLocationIds(req.user) };
    query.role = { $in: ['staff', 'chef'] };
  } else if (req.user.role === 'admin') {
    // Admins see branch admins and staff under their accessible locations
    const allowedLocs = userLocationIds(req.user);
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
  } else {
    // Any other role (e.g. a staff/chef/location_admin granted manageStaff):
    // restrict strictly to their own branch's staff & chefs — never global data.
    query.assignedLocation = { $in: userLocationIds(req.user) };
    query.role = { $in: ['staff', 'chef'] };
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
    if (req.user.role === 'super_admin' || canAccessLocation(req.user, req.query.locationId)) {
      const locationClause = {
        $or: [
          { assignedLocation: req.query.locationId },
          { accessibleLocations: req.query.locationId }
        ]
      };
      if (query.$and) {
        query.$and.push(locationClause);
      } else {
        query.$and = [locationClause];
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
  const limit = clampLimit(req.query.limit, 10, 1000); // allow large limit for the staff tree view
  const startIndex = (page - 1) * limit;
  const total = await User.countDocuments(query);

  const users = await User.find(query)
    // .lean() skips getters, so aadharNumber would be the raw ciphertext — and the
    // list never needs it (the detail view fetches the decrypted value). Exclude it.
    .select('-password -aadharNumber')
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
  // Branch admins can only act on Staff/Chef in their own branch.
  if (req.user.role === 'branch_admin' && !['staff', 'chef'].includes(user.role)) {
    res.status(403);
    throw new Error('Branch Admins can only promote their own Staff or Chef');
  }

  const oldRole = user.role;
  let nextRole = user.role;
  if (user.role === 'staff') nextRole = 'branch_admin';
  else if (user.role === 'branch_admin') nextRole = 'admin';
  else if (user.role === 'admin') nextRole = 'super_admin';

  // Ceiling: a non-super actor can only promote a user to a role STRICTLY BELOW
  // their own (stops e.g. a branch_admin manufacturing a peer branch_admin).
  if (req.user.role !== 'super_admin' && (ROLE_RANK[nextRole] || 0) >= (ROLE_RANK[req.user.role] || 0)) {
    res.status(403);
    throw new Error('You cannot promote a user to your own level or higher');
  }

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

  // Only act on users strictly below your own role (no peer/superior demotion).
  ensureCanManageUserRank(req, res, user, 'You cannot demote a user at or above your own role');

  if (req.user.role === 'admin' && (user.role === 'admin' || user.role === 'super_admin')) {
    res.status(403);
    throw new Error('You do not have permission to demote this user');
  }
  // Branch admins can only act on Staff/Chef in their own branch.
  if (req.user.role === 'branch_admin' && !['staff', 'chef'].includes(user.role)) {
    res.status(403);
    throw new Error('Branch Admins can only manage their own Staff or Chef');
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

  if (req.user.role === 'branch_admin' && !['staff', 'chef'].includes(user.role)) {
    res.status(403);
    throw new Error('Branch Admins can only update Staff or Chef personnel');
  }
  ensureCanManageUserRank(req, res, user, 'You cannot modify a user at or above your own role');
  ensureCanManageUserLocation(req, res, user, 'You do not have permission to update users from other locations');

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

  // Normalize email the same way login/signup do, so the stored value always
  // matches the (lowercased) login lookup — otherwise a mixed-case update would
  // lock the user out.
  if (updateData.email !== undefined) {
    updateData.email = String(updateData.email).trim().toLowerCase();
  }

  if (updateData.accessibleLocations !== undefined) {
    updateData.accessibleLocations = normalizeIdList(updateData.accessibleLocations);
  }

  // A non-super admin may only (re)assign branches they themselves manage —
  // otherwise a branch admin could move a staff member into a branch they don't own.
  if (req.user.role !== 'super_admin') {
    const targetBranches = [];
    if (updateData.assignedLocation) targetBranches.push(updateData.assignedLocation);
    if (Array.isArray(updateData.accessibleLocations)) targetBranches.push(...updateData.accessibleLocations);
    if (targetBranches.some((loc) => !canAccessLocation(req.user, loc))) {
      res.status(403);
      throw new Error('You cannot assign a branch you do not manage');
    }
  }

  // The aadharNumber schema setter (encrypt) does NOT run on findByIdAndUpdate —
  // Mongoose skips setters on query updates — so encrypt it explicitly here to keep
  // the value encrypted at rest. The model getter/validator handle decryption.
  if (updateData.aadharNumber) {
    updateData.aadharNumber = encrypt(updateData.aadharNumber);
  }

  // Role-change rules by actor:
  //  - super_admin: any role
  //  - admin: any role except admin/super_admin
  //  - branch_admin: only switch their own staff/chef between staff and chef
  if (req.body.role) {
    if (req.user.role === 'super_admin') {
      updateData.role = req.body.role;
    } else if (req.user.role === 'admin' && !['admin', 'super_admin'].includes(req.body.role)) {
      updateData.role = req.body.role;
    } else if (req.user.role === 'branch_admin' && ['staff', 'chef'].includes(req.body.role)) {
      updateData.role = req.body.role;
    }
  }

  normalizeBranchAdminUpdate(user, updateData);

  // A branch admin's branches must all belong to a single admin.
  const finalRoleForBranchCheck = updateData.role || user.role;
  if (finalRoleForBranchCheck === 'branch_admin' && updateData.accessibleLocations !== undefined) {
    await assertBranchesUnderOneAdmin(updateData.accessibleLocations);
  }

  if (updateData.assignedLocation && req.user.role !== 'super_admin') {
    enforceLocationAccess(req, res, updateData.assignedLocation, 'You do not have permission to assign this location');
  }

  if (updateData.accessibleLocations !== undefined && req.user.role !== 'super_admin') {
    if (req.user.role === 'branch_admin') {
      delete updateData.accessibleLocations;
    } else if (req.user.role === 'admin') {
      const unauthorized = updateData.accessibleLocations.some(
        loc => !canAccessLocation(req.user, loc)
      );
      if (unauthorized) {
        res.status(403);
        throw new Error('You cannot grant access to locations you do not manage');
      }
    }
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
    if (!['staff', 'chef'].includes(user.role)) {
      res.status(403);
      throw new Error('Branch Admins can only delete Staff or Chef personnel');
    }
  }
  ensureCanManageUserRank(req, res, user, 'You cannot delete a user at or above your own role');
  ensureCanManageUserLocation(req, res, user, 'You do not have permission to delete users from other locations');

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

  ensureCanManageUserRank(req, res, user, 'You cannot block a user at or above your own role');
  ensureCanManageUserLocation(req, res, user, 'You do not have permission to block users from other branches');

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
  const user = await User.findById(req.params.id)
    .select('-password')
    .populate('assignedLocation', 'name city')
    .populate('accessibleLocations', 'name city');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Location restriction
  ensureCanManageUserRank(req, res, user, 'You do not have permission to view this user');
  ensureCanManageUserLocation(req, res, user, 'You do not have permission to view users from other locations');

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
  // Invalidate every existing session (including any stolen token) on password change.
  user.sessionVersion = (user.sessionVersion || 1) + 1;
  await user.save();

  res.json({
    success: true,
    requireRelogin: true,
    message: 'Password updated. Please log in again with your new password.',
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

  ensureCanManageUserLocation(req, res, user, 'You do not have permission to modify permissions outside your locations');

  let isAuthorized = false;

  if (actorRole === 'super_admin') {
    isAuthorized = true;
  } else if (actorRole === 'admin') {
    if (['branch_admin', 'location_admin', 'staff', 'chef'].includes(targetRole)) {
      isAuthorized = true;
    }
  } else if (actorRole === 'branch_admin' && (targetRole === 'staff' || targetRole === 'chef')) {
    if (canAccessLocation(req.user, user.assignedLocation)) {
      isAuthorized = true;
    } else {
      res.status(403);
      throw new Error('You can only modify permissions for staff within your assigned branches');
    }
  }

  if (!isAuthorized) {
    res.status(403);
    throw new Error(`As a ${actorRole}, you cannot assign permissions to a ${targetRole}`);
  }

  // Validate + merge so a partial/empty body can't silently wipe existing
  // permissions (explicit false still unsets a key).
  if (!req.body.permissions || typeof req.body.permissions !== 'object' || Array.isArray(req.body.permissions)) {
    res.status(400);
    throw new Error('A permissions object is required');
  }

  // Known permission keys only — never merge arbitrary req.body keys into the
  // permissions object (mirrors registerUser's whitelist).
  const ALL_PERMISSION_KEYS = [
    'viewRevenue', 'editRevenue', 'viewOrders', 'manageOrders', 'forceComplete',
    'exportReports', 'manageStaff', 'manageNotifications', 'viewAnalytics', 'manageCoupons',
    'manageBranches', 'viewAuditLogs', 'impersonateUsers', 'viewAdminCenter',
    'manageGlobalMenu', 'sendGlobalNotifications', 'sendMessages', 'messageSuperAdmin',
  ];

  const actorIsSuper = actorRole === 'super_admin';
  const actorPermissions = req.user.permissions || {};
  const requestedPermissions = req.body.permissions;

  // Build the merged object key-by-key from existing perms, applying the
  // actor-grant gate WHILE building. Requested values are coerced to strict
  // booleans (=== true) so a truthy non-boolean like "false" or 1 can't bypass
  // the cast. A non-super actor may only set a key to true if the actor holds it.
  const existingPerms = user.permissions?.toObject ? user.permissions.toObject() : (user.permissions || {});
  const mergedPerms = {};
  ALL_PERMISSION_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(requestedPermissions, key)) {
      const wantsTrue = requestedPermissions[key] === true;
      if (wantsTrue && !actorIsSuper && actorPermissions[key] !== true) {
        res.status(403);
        throw new Error(`You cannot assign the permission '${key}' because you do not have it`);
      }
      mergedPerms[key] = wantsTrue;
    } else if (existingPerms[key] !== undefined) {
      mergedPerms[key] = existingPerms[key] === true;
    }
  });

  user.permissions = mergedPerms;
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
