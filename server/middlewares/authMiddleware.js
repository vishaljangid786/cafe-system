const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

const verifyToken = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      if (!token) {
        res.status(401);
        throw new Error('Not authorized, token missing');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      // Security Check: Blocked/Inactive Users
      if (req.user.isBlocked) {
        res.status(403);
        throw new Error('Account suspended. Please contact administrator.');
      }

      if (req.user.active === false) {
        res.status(403);
        throw new Error('Account inactive. Access denied.');
      }

      if (decoded.impersonatedBy) {
        req.impersonator = await User.findById(decoded.impersonatedBy).select('-password');
        
        // Enterprise: View-only restriction
        if (decoded.isViewOnly && req.method !== 'GET') {
          res.status(403);
          throw new Error('Action restricted: View-only impersonation mode is active');
        }
      }

      next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(
        `User role '${req.user.role}' is not authorized to access this route`
      );
    }
    next();
  };
};

const authorizePermissions = (...permissions) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') {
      return next();
    }

    const userPermissions = req.user.permissions || {};
    const hasPermission = permissions.every(p => userPermissions[p]);

    if (!hasPermission) {
      res.status(403);
      throw new Error('User does not have the required permissions');
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRoles, authorizePermissions };
