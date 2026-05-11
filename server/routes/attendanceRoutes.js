const express = require('express');
const {
  markAttendance,
  getLocationAttendance,
  getAllAttendance,
  getMonthlySummary,
  getMyAttendance,
} = require('../controllers/attendanceController');
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/my')
  .get(getMyAttendance);

router.route('/mark')
  .post(checkRoles('branch_admin', 'admin', 'super_admin'), checkPermissions('manageStaff'), markAttendance);

router.route('/location')
  .get(checkRoles('branch_admin', 'admin', 'super_admin'), checkPermissions('manageStaff'), getLocationAttendance);

router.route('/all')
  .get(checkRoles('admin', 'super_admin'), checkPermissions('manageStaff'), getAllAttendance);

router.route('/monthly-summary')
  .get(checkRoles('admin', 'super_admin'), checkPermissions('manageStaff'), getMonthlySummary);

module.exports = router;
