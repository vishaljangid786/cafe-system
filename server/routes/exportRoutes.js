const express = require('express');
const rateLimit = require('express-rate-limit');
const { withRateLimitStore } = require('../utils/rateLimitStore');
const router = express.Router();
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');
const { exportData } = require('../controllers/exportController');

// Exports build Excel/CSV/PDF documents — expensive enough to be a DoS lever, so
// cap them tighter than the global limiter.
const exportLimiter = rateLimit(withRateLimitStore({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many export requests. Please try again shortly.' },
}, 'exports'));

// @desc    Export Advanced Data
// @route   GET /api/export
router.get(
  '/',
  verifyToken,
  exportLimiter,
  // Permission-driven: super_admin bypasses; admin/branch/location admin hold
  // exportReports by default; a granted staff/chef passes too. (checkRoles ran
  // BEFORE this and 403'd granted lower roles.)
  checkPermissions('exportReports'),
  exportData
);

module.exports = router;
