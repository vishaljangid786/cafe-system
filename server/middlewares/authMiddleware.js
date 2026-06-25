const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

const getRequestToken = (req) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  return token;
};

const attachUserFromToken = async (req, res, token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  req.user = await User.findById(decoded.id).select('-password');

  if (!req.user) {
    res.status(401);
    throw new Error('User not found. Please login again.');
  }

  // Enterprise Session Revocation Check
  const tokenVersion = decoded.sessionVersion || 1; // Graceful migration for legacy tokens
  const userVersion = req.user.sessionVersion || 1;

  if (tokenVersion !== userVersion) {
    res.status(401);
    throw new Error('Session expired due to security update. Please log in again.');
  }

  // Security Check: Blocked/Inactive Users
  if (req.user.isBlocked) {
    res.status(403);
    throw new Error('Account suspended. Please contact administrator.');
  }

  if (req.user.active === false) {
    res.status(403);
    throw new Error('Account inactive. Permission denied.');
  }

  if (decoded.impersonatedBy) {
    req.impersonator = await User.findById(decoded.impersonatedBy).select('-password');

    // Re-validate the impersonator on every request: if their own account was
    // suspended/deactivated after the session started, end the impersonation.
    if (!req.impersonator || req.impersonator.isBlocked || req.impersonator.active === false) {
      res.status(403);
      throw new Error('Impersonation ended: the original account is no longer active. Please log in again.');
    }

    // Also honour the impersonator's OWN session revocation. The token carries the
    // TARGET's sessionVersion (validated above), so without this an admin who reset
    // their password / logged out everywhere couldn't kill a live impersonation
    // token. Legacy tokens lack the field → default to 1 for graceful migration.
    const impTokenVersion = decoded.impersonatorSessionVersion || 1;
    const impCurrentVersion = req.impersonator.sessionVersion || 1;
    if (impTokenVersion !== impCurrentVersion) {
      res.status(401);
      throw new Error('Session expired due to a security update on the original account. Please log in again.');
    }

    if (decoded.isViewOnly && req.method !== 'GET') {
      // Session changes — switching to ANOTHER user (hot-switch) or exiting the
      // impersonation — are navigation, not data mutations, so they're allowed even
      // in view-only mode. Every other write stays blocked.
      const url = req.originalUrl || req.url || '';
      const isSessionChange = req.method === 'POST' && /\/auth\/(impersonate\/|exit-impersonation)/.test(url);
      if (!isSessionChange) {
        res.status(403);
        throw new Error('Action restricted: View-only impersonation mode is active');
      }
    }
  }

  req.authToken = decoded;
  return decoded;
};

const verifyToken = asyncHandler(async (req, res, next) => {
  const token = getRequestToken(req);

  if (!token) {
    res.status(401);
    throw new Error('Please login to continue');
  }

  try {
    await attachUserFromToken(req, res, token);
    next();
  } catch (error) {
    if (res.statusCode === 200) {
      res.status(401);
    }
    throw new Error(error.message || 'Login failed. Please try again.');
  }
});

const optionalVerifyToken = asyncHandler(async (req, res, next) => {
  const token = getRequestToken(req);
  if (!token) return next();

  try {
    await attachUserFromToken(req, res, token);
  } catch (error) {
    req.user = null;
  }

  next();
});

const checkRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(
        `You do not have permission to open this area`
      );
    }
    next();
  };
};

const checkPermissions = (...permissions) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') {
      return next();
    }

    const userPermissions = req.user.permissions || {};
    const hasPermission = permissions.every(p => userPermissions[p]);

    if (!hasPermission) {
      console.error(`[AUTH_FAILURE] User: ${req.user.name} (${req.user.role}) - Missing Permissions: ${permissions.join(', ')}`);
      res.status(403);
      throw new Error('You do not have permission to do this');
    }
    next();
  };
};

// Allow access if the user's role is in `roles`, OR they hold ALL of the given
// permissions. super_admin always passes. This is what makes role-locked pages
// (Users, Branches, Audit Logs, Impersonate, analytics) grantable to any user
// via a permission, while keeping the original role access intact.
const checkRoleOrPermission = (roles = [], ...permissions) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    if (roles.includes(req.user.role)) return next();
    const userPermissions = req.user.permissions || {};
    if (permissions.length > 0 && permissions.every((p) => userPermissions[p])) return next();
    res.status(403);
    throw new Error('You do not have permission to open this area');
  };
};

// Allow if super_admin OR the user holds ANY ONE of the given permissions.
const checkAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    const userPermissions = req.user.permissions || {};
    if (permissions.some((p) => userPermissions[p])) return next();
    res.status(403);
    throw new Error('You do not have permission to do this');
  };
};

// Gate for POST /auth/impersonate.
//  - Normal (not impersonating): super_admin, or anyone holding impersonateUsers.
//  - Already impersonating (HOT-SWITCH to another user without exiting): allowed
//    ONLY when the ORIGINAL impersonator is a super_admin. Delegated impersonators
//    must exit their current session first.
const canImpersonate = (req, res, next) => {
  if (req.impersonator) {
    if (req.impersonator.role === 'super_admin') return next();
    res.status(403);
    throw new Error('Exit the current session before logging in as another user');
  }
  if (req.user?.role === 'super_admin' || req.user?.permissions?.impersonateUsers === true) return next();
  res.status(403);
  throw new Error('You do not have permission to log in as other users');
};

module.exports = { verifyToken, optionalVerifyToken, checkRoles, checkPermissions, checkRoleOrPermission, checkAnyPermission, canImpersonate };
