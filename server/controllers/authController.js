const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');
const sendNotification = require('../utils/sendNotification');
const { logActivity } = require('../utils/auditLogger');
const AuditLog = require('../models/AuditLog');
const { canAccessLocation, normalizeIdList, assertBranchesUnderOneAdmin } = require('../utils/accessControl');

// Generate JWT
const generateToken = (id, sessionVersion, impersonatedBy = null, isViewOnly = false) => {
  const payload = { id, sessionVersion };
  if (impersonatedBy) {
    payload.impersonatedBy = impersonatedBy;
    payload.isViewOnly = isViewOnly;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

const isProductionRuntime = () => process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

const normalizeRoleLocations = (role, assignedLocation, accessibleLocations) => {
  const accessIds = normalizeIdList(accessibleLocations);
  const assignedId = normalizeIdList(assignedLocation)[0] || '';

  if (role === 'branch_admin') {
    const branchIds = normalizeIdList([assignedId, ...accessIds]);
    return {
      assignedLocation: assignedId || branchIds[0],
      accessibleLocations: branchIds,
    };
  }

  if (role === 'admin') {
    return {
      assignedLocation: undefined,
      accessibleLocations: accessIds,
    };
  }

  return {
    assignedLocation: assignedId || undefined,
    accessibleLocations: [],
  };
};

const getAuthCookieOptions = () => ({
  expires: new Date(
    Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
  ),
  httpOnly: true,
  secure: isProductionRuntime(),
  sameSite: isProductionRuntime() ? 'none' : 'lax',
});

// Helper to set token in cookie and send response
const sendTokenResponse = (user, statusCode, res, impersonatedBy = null, isViewOnly = false) => {
  const token = generateToken(user._id, user.sessionVersion, impersonatedBy, isViewOnly);

  // Token is set as httpOnly cookie only — never returned in JSON body to prevent XSS theft
  res
    .status(statusCode)
    .cookie('token', token, getAuthCookieOptions())
    .json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedLocation: user.assignedLocation,
        accessibleLocations: user.accessibleLocations,
        permissions: user.permissions
      }
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res, next) => {
  const {
    name, email, password, phone, gender, age,
    address1, address2, city, state, country, pincode,
    alternatePhone, role,
    aadharNumber, highestQualification, monthlySalary
  } = req.body;
  let assignedLocation = req.body.assignedLocation;
  let accessibleLocations = normalizeIdList(req.body.accessibleLocations);

  const userCount = await User.countDocuments();
  let finalRole = role;

  if (userCount === 0) {
    finalRole = 'super_admin';
  } else {
    // Standard auth middleware should have populated req.user
    const creator = req.user;
    
    if (!creator) {
      res.status(401);
      throw new Error('You do not have permission to add new staff');
    }

    // Authoritative role gate: a creator may only create roles BELOW them.
    // Without this, an authenticated staff/chef/location_admin could pass
    // `role: 'super_admin'` and self-escalate (no branch_admin/admin branch caught them).
    const CREATABLE_ROLES = {
      super_admin: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'],
      admin: ['branch_admin', 'location_admin', 'staff', 'chef'],
      branch_admin: ['staff', 'chef'],
    };
    if (!(CREATABLE_ROLES[creator.role] || []).includes(role)) {
      res.status(403);
      throw new Error('You do not have permission to create a user with this role');
    }

    if (creator.role === 'branch_admin') {
      if (!['staff', 'chef'].includes(role)) {
        res.status(403);
        throw new Error('Branch Admins can only register Staff or Chef members');
      }
      assignedLocation = assignedLocation || creator.assignedLocation;
      if (!canAccessLocation(creator, assignedLocation)) {
        res.status(403);
        throw new Error('Branch Admins can only register staff for their assigned branches');
      }
      // Branch admin cannot set accessibleLocations
      accessibleLocations = [];
    } else if (creator.role === 'admin') {
      if (['super_admin', 'admin'].includes(role)) {
        res.status(403);
        throw new Error('Admins can only register Branch Admins and Staff');
      }
      // Admin can only assign locations they have permission for
      if (assignedLocation && !canAccessLocation(creator, assignedLocation)) {
        res.status(403);
        throw new Error('You cannot assign a location you do not have permission for');
      }
      if (accessibleLocations?.length) {
        const hasUnauthorized = accessibleLocations.some(
          loc => !canAccessLocation(creator, loc)
        );
        if (hasUnauthorized) {
          res.status(403);
          throw new Error('You cannot grant permission for locations you do not manage');
        }
      }
    }
  }

  const normalizedLocations = normalizeRoleLocations(finalRole, assignedLocation, accessibleLocations);
  assignedLocation = normalizedLocations.assignedLocation;
  accessibleLocations = normalizedLocations.accessibleLocations;

  if (finalRole === 'branch_admin' && accessibleLocations.length === 0) {
    res.status(400);
    throw new Error('Please assign at least one branch to this Branch Admin');
  }

  // A branch admin's branches must all belong to a single admin.
  if (finalRole === 'branch_admin') {
    await assertBranchesUnderOneAdmin(accessibleLocations);
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  let aadharImage = '';
  let profileImageUrl = '';

  if (req.files) {
    if (req.files.aadharImage) aadharImage = req.files.aadharImage[0].path;
    if (req.files.profileImage) profileImageUrl = req.files.profileImage[0].path;
  }

  // Default permissions per role so core features work out-of-the-box
  const DEFAULT_PERMISSIONS = {
    super_admin: { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true },
    admin:       { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true },
    branch_admin:   { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: false, viewAnalytics: true, manageCoupons: false },
    location_admin: { viewRevenue: true, editRevenue: false, viewOrders: true, manageOrders: true, forceComplete: false, exportReports: true, manageStaff: false, manageNotifications: false, viewAnalytics: true, manageCoupons: false },
    staff: { viewRevenue: false, editRevenue: false, viewOrders: true, manageOrders: true, forceComplete: false, exportReports: false, manageStaff: false, manageNotifications: false, viewAnalytics: false, manageCoupons: false },
    chef:  { viewRevenue: false, editRevenue: false, viewOrders: true, manageOrders: true, forceComplete: false, exportReports: false, manageStaff: false, manageNotifications: false, viewAnalytics: false, manageCoupons: false },
  };
  const defaultPerms = DEFAULT_PERMISSIONS[finalRole] || {};

  // Start from the role's sensible defaults; if the creator sent an explicit
  // permission selection, use that instead — but a non-super-admin can only
  // grant permissions they themselves hold. (A super_admin role always gets the
  // full default set since it bypasses permission checks anyway.)
  let finalPermissions = { ...defaultPerms };
  if (finalRole !== 'super_admin' && req.user) {
    let requested = req.body.permissions;
    if (typeof requested === 'string') {
      try { requested = JSON.parse(requested); } catch (e) { requested = null; }
    }
    if (requested && typeof requested === 'object') {
      const ALL_PERMISSION_KEYS = [
        'viewRevenue', 'editRevenue', 'viewOrders', 'manageOrders', 'forceComplete',
        'exportReports', 'manageStaff', 'manageNotifications', 'viewAnalytics', 'manageCoupons',
        'manageBranches', 'viewAuditLogs', 'impersonateUsers', 'viewAdminCenter',
        'manageGlobalMenu', 'sendGlobalNotifications',
      ];
      const actorIsSuper = req.user.role === 'super_admin';
      const actorPerms = req.user.permissions || {};
      finalPermissions = {};
      ALL_PERMISSION_KEYS.forEach((k) => {
        finalPermissions[k] = requested[k] === true && (actorIsSuper || actorPerms[k] === true);
      });
    }
  }

  const user = await User.create({
    name, email, password, phone, gender, age,
    address1, address2, city, state, country, pincode,
    alternatePhone, role: finalRole, assignedLocation, accessibleLocations,
    aadharNumber, aadharImage, profileImageUrl, highestQualification, monthlySalary,
    permissions: finalPermissions
  });

  if (user) {
    await sendNotification({
      title: 'New Staff Synced',
      message: `User ${user.name} (${user.role}) has been added to the matrix.`,
      type: 'user_action',
      performedByUser: user,
      locationId: user.assignedLocation,
    });

    await logActivity(
      req.user,
      'USER_REGISTER',
      `Added new staff: ${user.name} (${user.role})`,
      req,
      { targetUserId: user._id, role: user.role, locationId: user.assignedLocation }
    );

    if (req.user) {
      // Return only safe fields — never the password hash or (decrypted) Aadhaar.
      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          assignedLocation: user.assignedLocation,
          accessibleLocations: user.accessibleLocations,
          permissions: user.permissions,
        },
      });
    } else {
      sendTokenResponse(user, 201, res);
    }
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const cleanEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: cleanEmail }).populate('assignedLocation accessibleLocations');

  if (user && (await user.matchPassword(password))) {
    sendTokenResponse(user, 200, res);
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Impersonate another user
// @route   POST /api/auth/impersonate/:userId
// @access  Private (Super Admin)
const impersonateUser = asyncHandler(async (req, res, next) => {
  if (req.impersonator) {
    res.status(403);
    throw new Error('Already logged in as another user');
  }

  const targetUser = await User.findById(req.params.userId).populate('assignedLocation accessibleLocations');

  if (!targetUser) {
    res.status(404);
    throw new Error('Target user not found');
  }

  // Privilege-escalation guard: a delegated (non-super-admin) impersonator may
  // only log in as users STRICTLY BELOW their own role — never a peer or higher.
  // Without this, the impersonateUsers permission could be used to become an
  // admin/super_admin by impersonating one.
  const ROLE_RANK = { super_admin: 5, admin: 4, branch_admin: 3, location_admin: 2, staff: 1, chef: 1 };
  if (req.user.role !== 'super_admin' && (ROLE_RANK[targetUser.role] || 0) >= (ROLE_RANK[req.user.role] || 0)) {
    res.status(403);
    throw new Error('You can only log in as users below your own role');
  }

  const { viewOnly } = req.body;

  await AuditLog.create({
    action: 'IMPERSONATION_START',
    performedBy: req.user._id,
    targetUser: targetUser._id,
    details: `Admin ${req.user.name} logged in as ${targetUser.name} [Mode: ${viewOnly ? 'VIEW-ONLY' : 'FULL-CONTROL'}]`,
    role: req.user.role
  });

  sendTokenResponse(targetUser, 200, res, req.user._id, Boolean(viewOnly));
});

// @desc    Exit impersonation
// @route   POST /api/auth/exit-impersonation
// @access  Private
const exitImpersonation = asyncHandler(async (req, res, next) => {
  if (!req.impersonator) {
    res.status(400);
    throw new Error('Not currently impersonating anyone');
  }

  const originalUser = await User.findById(req.impersonator._id).populate('assignedLocation accessibleLocations');

  if (!originalUser) {
    res.status(404);
    throw new Error('Original admin user not found');
  }

  await AuditLog.create({
    action: 'IMPERSONATION_EXIT',
    performedBy: req.user._id,
    details: `Admin ${originalUser.name} exited impersonation`,
    role: req.user.role
  });

  sendTokenResponse(originalUser, 200, res);
});

// @desc    Logout user / clear cookie
// @route   GET /api/auth/logout
// @access  Private
const logoutUser = asyncHandler(async (req, res, next) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProductionRuntime(),
    sameSite: isProductionRuntime() ? 'none' : 'lax',
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('assignedLocation accessibleLocations');

  if (user) {
    const userData = user.toObject();
    if (req.impersonator) {
      userData.impersonatedBy = req.impersonator;
    }

    res.json({
      success: true,
      data: userData,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getProfile,
  impersonateUser,
  exitImpersonation,
};
