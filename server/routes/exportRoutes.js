const express = require('express');
const router = express.Router();
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');
const { exportData } = require('../controllers/exportController');

// @desc    Export Advanced Data
// @route   GET /api/export
router.get(
  '/', 
  verifyToken, 
  checkRoles('admin', 'super_admin', 'branch_admin'),
  checkPermissions('exportReports'), 
  exportData
);

module.exports = router;
