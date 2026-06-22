const express = require('express');
const router = express.Router();
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');
const { exportData } = require('../controllers/exportController');

// @desc    Export Advanced Data
// @route   GET /api/export
router.get(
  '/',
  verifyToken,
  // Permission-driven: super_admin bypasses; admin/branch/location admin hold
  // exportReports by default; a granted staff/chef passes too. (checkRoles ran
  // BEFORE this and 403'd granted lower roles.)
  checkPermissions('exportReports'),
  exportData
);

module.exports = router;
