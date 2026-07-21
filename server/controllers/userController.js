const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { enforceLocationAccess, canAccessLocation, escapeRegex, clampLimit, normalizeIdList, userLocationIds, assertBranchesUnderOneAdmin } = require('../utils/accessControl');

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

  // Scope the listing by the EFFECTIVE (impersonated) user, so normal staff/member
  // views stay true to whoever is being impersonated (e.g. an admin sees only their
  // own branches' members). The ONLY exception is the global "switch user" picker,
  // which passes ?forSwitch=1: there a super_admin impersonator gets the full user
  // list so they can hot-switch to anyone, even from inside a staff session.
  const forSwitch = req.query.forSwitch === '1' && req.impersonator?.role === 'super_admin';
  const actor = forSwitch ? req.impersonator : req.user;

  // Hierarchy Visibility Logic
  if (actor.role === 'branch_admin') {
    query.assignedLocation = { $in: userLocationIds(actor) };
    query.role = { $in: ['staff', 'chef'] };
  } else if (actor.role === 'admin') {
    // Admins see branch admins and staff under their accessible locations
    const allowedLocs = userLocationIds(actor);
    query.$and = [
      { role: { $in: ['branch_admin', 'location_admin', 'staff', 'chef'] } },
      {
        $or: [
          { assignedLocation: { $in: allowedLocs } },
          { accessibleLocations: { $in: allowedLocs } } // If an admin has permission for another admin's location
        ]
      }
    ];
  } else if (actor.role === 'super_admin') {
    query.role = { $in: ['admin', 'branch_admin', 'location_admin', 'staff', 'chef'] };
  } else {
    // Any other role (e.g. a staff/chef/location_admin granted manageStaff):
    // restrict strictly to their own branch's staff & chefs — never global data.
    query.assignedLocation = { $in: userLocationIds(actor) };
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
      ? ['admin', 'branch_admin', 'location_admin', 'staff', 'chef']
      : ['branch_admin', 'location_admin', 'staff', 'chef'];

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

  // Removed people are hidden by default. A super_admin can ask for them
  // explicitly to review or restore; nobody else can see them at all, so a
  // delegated manageStaff permission cannot be used to browse ex-employees.
  const wantsDeleted = req.query.includeDeleted === 'true' && req.user.role === 'super_admin';
  if (req.query.status === 'deleted' && req.user.role === 'super_admin') {
    query.deletedAt = { $ne: null };
  } else if (!wantsDeleted) {
    query.deletedAt = null;
  }

  // Status Filter (Blocked/Active)
  if (req.query.status && req.query.status !== 'deleted') {
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

  // Join Date Filter (filter people by when their account was created)
  if (req.query.joinedStart || req.query.joinedEnd) {
    const createdAt = {};
    if (req.query.joinedStart) {
      const start = new Date(req.query.joinedStart);
      if (!isNaN(start.getTime())) createdAt.$gte = start;
    }
    if (req.query.joinedEnd) {
      const end = new Date(req.query.joinedEnd);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999); // include the whole end day
        createdAt.$lte = end;
      }
    }
    if (Object.keys(createdAt).length) query.createdAt = createdAt;
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
    .populate({ path: 'assignedLocation', select: 'name city cafe', populate: { path: 'cafe', select: 'name' } })
    .populate({ path: 'accessibleLocations', select: 'name city cafe', populate: { path: 'cafe', select: 'name' } })
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
    notifyUserId: user._id,
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
  // Force-disconnect live sockets so they reconnect with the demoted role's scope
  // (a stale socket was authorized at the old role at handshake).
  require('../config/socket').disconnectUser(user._id);

  const { logSecurityAction } = require('../utils/auditLogger');
  await logSecurityAction(req, 'USER_DEMOTED', { oldRole, newRole: prevRole }, user._id, 'User');

  await sendNotification({
    title: 'User Demoted',
    message: `User ${user.name} demoted to ${prevRole} by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    locationId: user.assignedLocation,
    notifyUserId: user._id,
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

  // Do NOT encrypt aadharNumber here: Mongoose 9 runs schema setters on
  // findByIdAndUpdate, so the model's `set: encrypt` already encrypts it once.
  // Encrypting again here would double-encrypt it — the validator decrypts a
  // single layer, sees ciphertext instead of 12 digits, and rejects every save.

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

  // If this update deactivated the account or changed its role, end its live sessions.
  // Deactivation also bumps sessionVersion to kill any outstanding HTTP token; a
  // role change just force-disconnects sockets so they reconnect with fresh scope
  // (HTTP already reloads role from the DB on every request).
  const wasDeactivated = updateData.active === false;
  const roleChanged = updateData.role && updateData.role !== user.role;
  if (wasDeactivated) {
    await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
  }
  if (wasDeactivated || roleChanged) {
    require('../config/socket').disconnectUser(user._id);
  }

  // Notify the affected user + the branch's managers about the change.
  let updateMessage;
  if (updateData.active === false) {
    updateMessage = `${user.name}'s account was deactivated by ${req.user.name}.`;
  } else if (updateData.active === true) {
    updateMessage = `${user.name}'s account was reactivated by ${req.user.name}.`;
  } else if (updateData.role && updateData.role !== user.role) {
    updateMessage = `${user.name}'s role was changed to ${updateData.role} by ${req.user.name}.`;
  } else {
    updateMessage = `${user.name}'s details were updated by ${req.user.name}.`;
  }
  await sendNotification({
    title: 'User Updated',
    message: updateMessage,
    type: 'user_action',
    performedByUser: req.user,
    locationId: updatedUser.assignedLocation || user.assignedLocation,
    notifyUserId: user._id,
  });

  res.json({
    success: true,
    data: updatedUser,
  });
});

/**
 * Shared guard for every destructive action against a user. Returns the target
 * document, or throws through Express' error handler with the right status.
 */
const loadDeletableUser = async (req, res, { verb }) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (req.user.role === 'branch_admin') {
    if (!['staff', 'chef'].includes(user.role)) {
      res.status(403);
      throw new Error('Branch Admins can only delete Staff or Chef personnel');
    }
  }
  ensureCanManageUserRank(req, res, user, `You cannot ${verb} a user at or above your own role`);
  ensureCanManageUserLocation(req, res, user, `You do not have permission to ${verb} users from other locations`);

  if (user.role === 'super_admin') {
    res.status(403);
    throw new Error('Super Admin cannot be deleted');
  }

  if (String(user._id) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot delete your own account');
  }

  return user;
};

// @desc    What would be affected by removing this user
// @route   GET /api/users/:id/impact
// @access  Private (Super Admin, Admin, Location Admin)
const getUserDeleteImpact = asyncHandler(async (req, res) => {
  const user = await loadDeletableUser(req, res, { verb: 'delete' });
  const { previewUserImpact } = require('../services/cascadeDelete');

  const impact = await previewUserImpact(user);

  // Surfaced separately from the dependency counts because it is a hard block,
  // not something the operator can confirm away: an order mid-preparation has
  // to reach the pass before the person who owns it can leave.
  const Order = require('../models/Order');
  const activeOrders = await Order.countDocuments({
    $or: [{ assignedChef: user._id }, { createdBy: user._id }],
    status: { $nin: ['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'] },
  });

  // Only a super_admin gets the "delete their data too" checkboxes.
  const canPurge = req.user.role === 'super_admin';

  res.json({ success: true, data: { ...impact, activeOrders, canPurge } });
});

// @desc    Remove a user
// @route   DELETE /api/users/:id
// @access  Private (Super Admin, Admin, Location Admin)
//
// Modes (body or query):
//   'solo'      default — remove this person only. Their staff keep working and
//               simply lose a lead until one is assigned.
//   'reassign'  remove them and hand their seat to `replacementId`, who is
//               promoted into the vacated role and inherits the branch, the
//               cafe memberships and every subordinate.
//   'cascade'   remove them together with everyone reporting to them.
//
// In all three the person is soft-deleted, never dropped: their orders, bills,
// expenses and payroll rows must keep resolving a name. Financial and audit
// records are untouched by every mode.
const deleteUser = asyncHandler(async (req, res) => {
  const user = await loadDeletableUser(req, res, { verb: 'delete' });

  const mode = String(req.body?.mode || req.query?.mode || 'solo');
  if (!['solo', 'reassign', 'cascade'].includes(mode)) {
    res.status(400);
    throw new Error('Invalid delete mode');
  }
  // Only a super_admin may take out a lead together with their whole team.
  if (mode === 'cascade' && req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error('Only a Super Admin can delete a user along with their team');
  }

  // Optional hard-delete of the person's records (orders they took, revenue
  // entries, expenses, attendance, payroll…). Each group must be named
  // explicitly; leaving this empty keeps every record, re-attributed to
  // "<name> (removed)". Super admin only — nobody else can destroy history.
  const purgeKeys = Array.isArray(req.body?.purgeKeys) ? req.body.purgeKeys.map(String) : [];
  if (purgeKeys.length && req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error("Only a Super Admin can delete a user's records along with them");
  }

  const force = req.body?.force === true || req.query?.force === 'true';

  const Order = require('../models/Order');
  const activeOrders = await Order.countDocuments({
    $or: [{ assignedChef: user._id }, { createdBy: user._id }],
    status: { $nin: ['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'] },
  });

  // A super_admin can override the open-order guard deliberately; nobody else
  // can, and even they have to ask for it explicitly.
  if (activeOrders > 0 && !(force && req.user.role === 'super_admin')) {
    res.status(400);
    throw new Error(
      `Cannot delete "${user.name}" — ${activeOrders} order(s) are still in progress. Close them first.`
    );
  }

  const { softDeleteUsers, findSubordinates } = require('../services/cascadeDelete');

  const userId = user._id;
  const userName = user.name;
  const locationId = user.assignedLocation;

  let replacement = null;
  let cascadedCount = 0;

  if (mode === 'reassign') {
    const replacementId = req.body?.replacementId;
    if (!replacementId) {
      res.status(400);
      throw new Error('Select who takes over before removing this user');
    }
    replacement = await User.findOne({ _id: replacementId, deletedAt: null });
    if (!replacement) {
      res.status(404);
      throw new Error('Replacement user not found');
    }
    if (String(replacement._id) === String(userId)) {
      res.status(400);
      throw new Error('A user cannot replace themselves');
    }
    if (replacement.role === 'super_admin') {
      res.status(400);
      throw new Error('A Super Admin cannot take over a branch role');
    }

    // Promote into the vacated seat and inherit its whole scope. Cafe and branch
    // lists are unioned rather than overwritten so a replacement already running
    // another branch does not lose it.
    replacement.role = user.role;
    if (user.assignedLocation) replacement.assignedLocation = user.assignedLocation;

    const mergeIds = (existing, incoming) => {
      const seen = new Set((existing || []).map(String));
      (incoming || []).forEach((id) => seen.add(String(id)));
      return [...seen];
    };
    replacement.accessibleLocations = mergeIds(replacement.accessibleLocations, user.accessibleLocations);
    replacement.cafes = mergeIds(replacement.cafes, user.cafes);
    replacement.allowedPages = mergeIds(replacement.allowedPages, user.allowedPages);
    // The seat's authority travels with it, so the branch is not left with a
    // lead who cannot approve anything.
    if (user.permissions) {
      const src = user.permissions.toObject ? user.permissions.toObject() : user.permissions;
      Object.entries(src).forEach(([k, v]) => {
        if (v === true) replacement.permissions[k] = true;
      });
    }
    // Role changed, so any cached token claiming the old role must die.
    replacement.sessionVersion = (replacement.sessionVersion || 1) + 1;
    await replacement.save({ validateModifiedOnly: true });
  }

  let cascadedIds = [];
  if (mode === 'cascade') {
    const subordinates = await findSubordinates(user);
    if (subordinates.length) {
      cascadedIds = subordinates.map((s) => s._id);
      cascadedCount = await softDeleteUsers(cascadedIds, {
        actorId: req.user._id,
        reason: `Team of ${userName} removed`,
      });
    }
  }

  await softDeleteUsers([userId], {
    actorId: req.user._id,
    reason: String(req.body?.reason || '').slice(0, 200),
  });

  // Hard-delete the explicitly chosen record groups — for the person and, on a
  // cascade, for their removed team as well (their records go by the same
  // choice; keeping a deleted team's orders while purging the lead's would
  // leave a half-erased trail nobody asked for).
  let purged = [];
  if (purgeKeys.length) {
    const { executePreservePurge } = require('../services/cascadeDelete');
    const { USER_DEPENDENTS } = require('../services/dependencyGraph');
    purged = await executePreservePurge(USER_DEPENDENTS, [userId, ...cascadedIds], purgeKeys);
  }
  const purgedTotal = purged.reduce((s, r) => s + r.count, 0);

  const { logSecurityAction } = require('../utils/auditLogger');
  await logSecurityAction(
    req,
    'USER_DELETED',
    { userName, mode, cascadedCount, replacement: replacement?.name || null, forced: activeOrders > 0, purged },
    userId,
    'User'
  );

  let message = `${userName} was removed`;
  if (mode === 'reassign') message += `, and ${replacement.name} took over as ${user.role.replace(/_/g, ' ')}`;
  if (mode === 'cascade') message += ` along with ${cascadedCount} team member(s)`;
  if (purgedTotal > 0) message += `. ${purgedTotal} of their record(s) were permanently deleted`;

  await sendNotification({
    title: 'User Removed',
    message: `${message} by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    locationId,
  });

  res.json({
    success: true,
    message,
    data: { mode, cascadedCount, replacementId: replacement?._id || null, purged },
  });
});

// @desc    Irreversibly erase a removed user's personal data
// @route   DELETE /api/users/:id/purge
// @access  Private (Super Admin only)
//
// Where nothing references the person, the document is dropped outright. Where
// something does — an order they took, a payroll row — the document survives
// stripped of every personal field, because deleting it would break the
// financial record that must be preserved. Either way the person is
// unrecoverable afterwards.
const purgeUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (user.role === 'super_admin') {
    res.status(403);
    throw new Error('Super Admin cannot be purged');
  }
  if (!user.deletedAt) {
    res.status(400);
    throw new Error('Remove the user first, then purge');
  }

  const { countDependents } = require('../services/cascadeDelete');
  const { USER_DEPENDENTS } = require('../services/dependencyGraph');
  const rows = await countDependents(USER_DEPENDENTS, [user._id]);
  const referenced = rows.reduce((sum, r) => sum + r.count, 0);

  const userId = user._id;
  const userName = user.name;

  if (referenced === 0) {
    await user.deleteOne();
  } else {
    // Anonymise in place. The `_id` stays valid so every historical `populate`
    // still resolves and renders "Removed user" instead of a blank cell.
    user.name = 'Removed user';
    user.email = `purged.${user._id}@removed.invalid`;
    user.deletedEmail = null;
    user.phone = '';
    user.alternatePhone = '';
    user.city = '';
    user.state = '';
    user.pincode = '';
    user.aadharNumber = '';
    user.aadharImage = '';
    user.profileImageUrl = '';
    user.monthlySalary = 0;
    user.password = require('crypto').randomBytes(32).toString('hex');
    user.purgedAt = new Date();
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await user.save({ validateModifiedOnly: true });
  }

  const { logSecurityAction } = require('../utils/auditLogger');
  await logSecurityAction(
    req,
    'USER_PURGED',
    { userName, referenced, hardDeleted: referenced === 0 },
    userId,
    'User'
  );

  res.json({
    success: true,
    message:
      referenced === 0
        ? `${userName} was permanently deleted`
        : `${userName}'s personal data was erased. ${referenced} financial or audit record(s) were preserved and now show "Removed user".`,
    data: { hardDeleted: referenced === 0, preservedRecords: referenced },
  });
});

// @desc    Bring back a removed user
// @route   POST /api/users/:id/restore
// @access  Private (Super Admin only)
const restoreUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (!user.deletedAt) {
    res.status(400);
    throw new Error('This user is not removed');
  }
  if (user.purgedAt) {
    res.status(400);
    throw new Error('This user was permanently erased and cannot be restored');
  }

  const reclaimed = await user.reclaimEmail();
  if (!reclaimed) {
    res.status(409);
    throw new Error(
      `Cannot restore: ${user.deletedEmail} now belongs to another account. Change that address first.`
    );
  }

  user.deletedAt = null;
  user.deletedBy = null;
  user.deletedReason = '';
  user.isBlocked = false;
  user.active = true;
  await user.save({ validateModifiedOnly: true });

  const { logSecurityAction } = require('../utils/auditLogger');
  await logSecurityAction(req, 'USER_RESTORED', { userName: user.name }, user._id, 'User');

  res.json({ success: true, message: `${user.name} was restored`, data: { id: user._id } });
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

  // A removed account is already blocked. Toggling it here would silently
  // un-block a deleted person and hand them a working login again.
  if (user.deletedAt) {
    res.status(400);
    throw new Error('This user has been removed. Restore them first.');
  }

  ensureCanManageUserRank(req, res, user, 'You cannot block a user at or above your own role');
  ensureCanManageUserLocation(req, res, user, 'You do not have permission to block users from other branches');

  user.isBlocked = !user.isBlocked;
  // When blocking, kill the user's live sessions immediately: bump sessionVersion to
  // invalidate any outstanding HTTP token, and force-disconnect their sockets (only
  // authorized at handshake, so a live one would keep streaming branch/role events).
  if (user.isBlocked) {
    user.sessionVersion = (user.sessionVersion || 1) + 1;
  }
  await user.save();
  if (user.isBlocked) {
    require('../config/socket').disconnectUser(user._id);
  }

  await sendNotification({
    title: user.isBlocked ? 'User Blocked' : 'User Unblocked',
    message: `${user.name} was ${user.isBlocked ? 'blocked' : 'unblocked'} by ${req.user.name}.`,
    type: 'user_action',
    priority: user.isBlocked ? 'high' : 'medium',
    performedByUser: req.user,
    locationId: user.assignedLocation,
    notifyUserId: user._id,
  });

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

  // Page-level access. When allowedPages is sent, gate it to pages the actor can
  // grant, then RECOMPUTE the coarse page-permissions from the granted pages (a
  // legacy perm is true iff some granted page maps to it) so the data APIs — still
  // gated by the old keys — match the page selection. Capabilities are untouched.
  let nextAllowedPages = user.allowedPages || [];
  if (req.body.allowedPages !== undefined) {
    const { sanitizePages, permsForPages, DERIVABLE_PERMS } = require('../utils/pageAccess');
    let reqPages = req.body.allowedPages;
    if (typeof reqPages === 'string') { try { reqPages = JSON.parse(reqPages); } catch (e) { reqPages = null; } }
    if (Array.isArray(reqPages)) {
      const actorPages = new Set(req.user.allowedPages || []);
      nextAllowedPages = sanitizePages(reqPages).filter((k) => actorIsSuper || actorPages.has(k));
      // Recompute every page-derivable coarse permission from the granted pages (a
      // perm is true iff some surviving page grants it). Capabilities (editRevenue,
      // forceComplete, …) are NOT derivable, so the toggles above are left intact.
      const grantedPerms = permsForPages(nextAllowedPages);
      DERIVABLE_PERMS.forEach((perm) => {
        mergedPerms[perm] = mergedPerms[perm] === true || grantedPerms.has(perm);
      });
    }
  }

  // Per-page ACTION permissions (Add/Modify/Delete/Approve). Merge key-by-key so a
  // partial body can't wipe existing grants; gate every key the actor turns ON to
  // actions the actor can perform themselves (super_admin grants anything). The
  // server is the source of truth here — the client gate is only UX.
  let nextActionPermissions;
  if (req.body.actionPermissions !== undefined) {
    const { sanitizeActionPermissions, userCanAct } = require('../utils/actionPermissions');
    let reqActions = req.body.actionPermissions;
    if (typeof reqActions === 'string') { try { reqActions = JSON.parse(reqActions); } catch (e) { reqActions = null; } }
    const requested = sanitizeActionPermissions(reqActions);
    const existing = user.actionPermissions && user.actionPermissions.toObject
      ? user.actionPermissions.toObject()
      : (user.actionPermissions || {});
    const merged = { ...existing };
    Object.keys(requested).forEach((key) => {
      const wantsTrue = requested[key] === true;
      if (wantsTrue && !userCanAct(req.user, key)) {
        res.status(403);
        throw new Error(`You cannot grant the action '${key}' because you cannot perform it yourself`);
      }
      merged[key] = wantsTrue;
    });
    nextActionPermissions = merged;
  }

  if ((nextAllowedPages || []).length === 0 && !Object.values(mergedPerms).some(Boolean)
      && !(nextActionPermissions && Object.values(nextActionPermissions).some(Boolean))
      && !(user.actionPermissions && [...(user.actionPermissions.values?.() || [])].some(Boolean))) {
    res.status(400);
    throw new Error('A member must be granted at least one page access or permission.');
  }

  user.permissions = mergedPerms;
  user.allowedPages = nextAllowedPages;
  if (nextActionPermissions !== undefined) user.actionPermissions = nextActionPermissions;
  await user.save();
  // Force-disconnect live sockets so they reconnect and re-derive their room/scope
  // from the new permissions (sockets are only authorized at handshake).
  require('../config/socket').disconnectUser(user._id);

  await sendNotification({
    title: 'Permissions Updated',
    message: `${user.name}'s access permissions were updated by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    locationId: user.assignedLocation,
    notifyUserId: user._id,
  });

  res.json({
    success: true,
    message: 'Permissions updated successfully',
    data: { permissions: user.permissions, allowedPages: user.allowedPages, actionPermissions: user.actionPermissions }
  });
});

module.exports = {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserDeleteImpact,
  purgeUser,
  restoreUser,
  promoteUser,
  demoteUser,
  toggleBlocklist,
  updateProfile,
  changePassword,
  updateUserPermissions,
};
