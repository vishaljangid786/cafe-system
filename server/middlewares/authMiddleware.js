const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

const verifyToken = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401);
    throw new Error('Please login to continue');
  }

  try {
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
      
      if (decoded.isViewOnly && req.method !== 'GET') {
        res.status(403);
        throw new Error('Action restricted: View-only impersonation mode is active');
      }
    }

    next();
  } catch (error) {
    if (res.statusCode === 200) {
      res.status(401);
    }
    throw new Error(error.message || 'Login failed. Please try again.');
  }
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

module.exports = { verifyToken, checkRoles, checkPermissions, checkRoleOrPermission };
