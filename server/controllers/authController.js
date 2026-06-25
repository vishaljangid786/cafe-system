const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');
const sendNotification = require('../utils/sendNotification');
const { logActivity } = require('../utils/auditLogger');
const AuditLog = require('../models/AuditLog');
const { canAccessLocation, normalizeIdList, assertBranchesUnderOneAdmin } = require('../utils/accessControl');
const { addAdminToCafe } = require('../utils/cafeSync');
const Cafe = require('../models/Cafe');

// Generate JWT
const generateToken = (id, sessionVersion, impersonatedBy = null, isViewOnly = false, impersonatorSessionVersion = null) => {
  const payload = { id, sessionVersion };
  if (impersonatedBy) {
    payload.impersonatedBy = impersonatedBy;
    payload.isViewOnly = isViewOnly;
    // Embed the IMPERSONATOR's session version too, so revoking the original admin's
    // session (a password change / logout-all bumps their sessionVersion) also kills
    // any live impersonation token — see authMiddleware.attachUserFromToken.
    payload.impersonatorSessionVersion = impersonatorSessionVersion;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    // Never sign a token with no expiry — a missing/blank JWT_EXPIRE would
    // otherwise produce a token that never expires. Fall back to 30 days.
    expiresIn: process.env.JWT_EXPIRE || '30d',
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
const sendTokenResponse = (user, statusCode, res, impersonatedBy = null, isViewOnly = false, impersonatorSessionVersion = null, impersonatorRole = null) => {
  const token = generateToken(user._id, user.sessionVersion, impersonatedBy, isViewOnly, impersonatorSessionVersion);

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
        permissions: user.permissions,
        allowedPages: user.allowedPages || [],
        cafes: user.cafes || [],
        impersonatedBy: impersonatedBy || undefined,
        isImpersonating: Boolean(impersonatedBy),
        isViewOnly: impersonatedBy ? Boolean(isViewOnly) : false,
        // Real (original) impersonator's role — lets the UI offer "switch user
        // while impersonating" to super_admins only.
        impersonatorRole: impersonatedBy ? impersonatorRole : undefined,
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
  const cafes = normalizeIdList(req.body.cafes);

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
  // sendMessages defaults ON for every role so the role-based messaging hierarchy
  // works out of the box. messageSuperAdmin defaults OFF (schema default) — it is
  // an opt-in that lets a branch admin / staff / chef also reach the super admin.
  const DEFAULT_PERMISSIONS = {
    super_admin: { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true, sendMessages: true, messageSuperAdmin: true },
    admin:       { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true, sendMessages: true, messageSuperAdmin: true },
    branch_admin:   { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: false, viewAnalytics: true, manageCoupons: false, sendMessages: true },
    location_admin: { viewRevenue: true, editRevenue: false, viewOrders: true, manageOrders: true, forceComplete: false, exportReports: true, manageStaff: false, manageNotifications: false, viewAnalytics: true, manageCoupons: false, sendMessages: true },
    staff: { viewRevenue: false, editRevenue: false, viewOrders: true, manageOrders: true, forceComplete: false, exportReports: false, manageStaff: false, manageNotifications: false, viewAnalytics: false, manageCoupons: false, sendMessages: true },
    chef:  { viewRevenue: false, editRevenue: false, viewOrders: true, manageOrders: true, forceComplete: false, exportReports: false, manageStaff: false, manageNotifications: false, viewAnalytics: false, manageCoupons: false, sendMessages: true },
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

      // Messaging permissions have their own defaults (master switch is ON unless
      // explicitly turned off). They sit outside the "actor must already hold it"
      // rule so existing accounts that pre-date these fields can still grant them.
      finalPermissions.sendMessages = requested.sendMessages !== false;
      finalPermissions.messageSuperAdmin = requested.messageSuperAdmin === true
        && (actorIsSuper || req.user.role === 'admin' || actorPerms.messageSuperAdmin === true);
    }
  }

  // Page-level access (allowedPages). Default to the role's default pages; if the
  // creator sent a selection, use it — gated to pages the creator themselves holds
  // (super_admin grants anything). Then DERIVE the coarse page-permissions from the
  // granted pages so the data APIs (still gated by the old permission keys) work.
  const { ROLE_DEFAULT_PAGES, sanitizePages, permsForPages } = require('../utils/pageAccess');
  let finalPages = [...(ROLE_DEFAULT_PAGES[finalRole] || [])];
  if (finalRole !== 'super_admin' && req.user) {
    let reqPages = req.body.allowedPages;
    if (typeof reqPages === 'string') { try { reqPages = JSON.parse(reqPages); } catch (e) { reqPages = null; } }
    if (Array.isArray(reqPages)) {
      const actorIsSuperPg = req.user.role === 'super_admin';
      const actorPages = new Set(req.user.allowedPages || []);
      finalPages = sanitizePages(reqPages).filter((k) => actorIsSuperPg || actorPages.has(k));
    }
  }
  // No zero-access admin-tier members (Staff/Chef work from their own fixed menu).
  if (['admin', 'branch_admin', 'location_admin'].includes(finalRole) && finalPages.length === 0) {
    res.status(400);
    throw new Error('A member must be granted access to at least one page.');
  }
  // Derive the coarse permissions the granted pages need to FUNCTION (each page's
  // `grants`) and merge them in, so the data APIs (still gated by the legacy keys)
  // work — e.g. All Orders enables manageOrders, Cash Drawer enables viewRevenue.
  permsForPages(finalPages).forEach((perm) => { finalPermissions[perm] = true; });

  const user = await User.create({
    name, email, password, phone, gender, age,
    address1, address2, city, state, country, pincode,
    alternatePhone, role: finalRole, assignedLocation, accessibleLocations,
    cafes: ['admin', 'super_admin'].includes(finalRole) && cafes.length ? cafes : [],
    aadharNumber, aadharImage, profileImageUrl, highestQualification, monthlySalary,
    permissions: finalPermissions,
    allowedPages: finalPages,
  });

  if (user) {
    // Link an admin to the selected cafe(s): records cafe membership AND mirrors
    // each cafe's branches into accessibleLocations, so all branch-level scoping
    // keeps working. Only super_admins can reach finalRole === 'admin' here.
    if (finalRole === 'admin') {
      const requestedCafeIds = normalizeIdList(req.body.cafes);
      if (requestedCafeIds.length) {
        const validCafes = await Cafe.find({ _id: { $in: requestedCafeIds }, status: { $ne: 'deleted' } }).select('_id').lean();
        for (const c of validCafes) {
          await addAdminToCafe(c._id, user._id);
        }
      }
    }

    await sendNotification({
      title: 'New Member Added',
      message: `${user.name} (${user.role.replace('_', ' ')}) has been added to the team.`,
      type: 'user_action',
      performedByUser: req.user || user,
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

  if (!user) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  // Per-account lockout after repeated failures (independent of the IP throttle).
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 15 * 60 * 1000;
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const secsLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
    // Keep the lockout (429 + Retry-After), but use a message that does NOT
    // reveal whether this specific account exists/is locked — preventing the
    // 429 from being used as a username-enumeration oracle.
    res.status(429);
    res.set('Retry-After', String(secsLeft));
    throw new Error('Too many failed login attempts. Please try again later.');
  }

  const passwordMatch = await user.matchPassword(password);

  if (passwordMatch) {
    // A suspended/deactivated account must never receive a session token, even
    // with the correct password — otherwise the auth cookie is planted and the
    // "account suspended" state is bypassed at the login boundary.
    if (user.isBlocked) {
      res.status(403);
      throw new Error('Account suspended. Please contact administrator.');
    }
    if (user.active === false) {
      res.status(403);
      throw new Error('Account inactive. Permission denied.');
    }
    if (user.failedLoginAttempts || user.lockUntil) {
      await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
    }
    sendTokenResponse(user, 200, res);
  } else {
    // An expired lock resets the counter first, so a single late wrong attempt
    // can't immediately re-lock the account (which would let anyone keep a
    // victim locked out indefinitely with one failed try per window).
    const lockExpired = user.lockUntil && user.lockUntil.getTime() <= Date.now();
    const attempts = (lockExpired ? 0 : (user.failedLoginAttempts || 0)) + 1;
    const update = {
      failedLoginAttempts: attempts,
      lockUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null,
    };
    await User.updateOne({ _id: user._id }, { $set: update });
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

  // Branch scoping: a delegated (non-super) impersonator may only become a user
  // inside a branch they manage. Reject location-less/global targets (admins
  // have no assignedLocation) so the rank guard above can't be sidestepped by
  // impersonating a branch-less account.
  if (req.user.role !== 'super_admin') {
    if (!targetUser.assignedLocation || !canAccessLocation(req.user, targetUser.assignedLocation)) {
      res.status(403);
      throw new Error('You can only log in as users within branches you manage');
    }
  }

  const { viewOnly } = req.body;

  await AuditLog.create({
    action: 'IMPERSONATION_START',
    performedBy: req.user._id,
    targetUser: targetUser._id,
    details: `Admin ${req.user.name} logged in as ${targetUser.name} [Mode: ${viewOnly ? 'VIEW-ONLY' : 'FULL-CONTROL'}]`,
    role: req.user.role
  });

  sendTokenResponse(targetUser, 200, res, req.user._id, Boolean(viewOnly), req.user.sessionVersion);
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
  // Route is gated behind verifyToken, so req.user is the authenticated caller.
  // Revoke ONLY their own sessions (bump sessionVersion so the just-cleared token
  // can't be replayed) — never an arbitrary user id decoded from the request.
  if (req.user?._id) {
    await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } });
  }

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
    .populate('assignedLocation accessibleLocations cafes');

  if (user) {
    const userData = user.toObject();
    if (req.impersonator) {
      userData.impersonatedBy = req.impersonator;
      userData.isImpersonating = true;
      userData.isViewOnly = Boolean(req.authToken?.isViewOnly);
    } else {
      userData.isImpersonating = false;
      userData.isViewOnly = false;
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
