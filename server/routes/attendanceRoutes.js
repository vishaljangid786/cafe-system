const express = require('express');
const {
  markAttendance,
  getLocationAttendance,
  getAllAttendance,
  getMonthlySummary,
  getMyAttendance,
} = require('../controllers/attendanceController');
const { verifyToken, authorizeRoles, authorizePermissions } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/my')
  .get(getMyAttendance);

router.route('/mark')
  .post(authorizeRoles('branch_admin', 'admin', 'super_admin'), authorizePermissions('manageStaff'), markAttendance);

router.route('/location')
  .get(authorizeRoles('branch_admin', 'admin', 'super_admin'), authorizePermissions('manageStaff'), getLocationAttendance);

router.route('/all')
  .get(authorizeRoles('admin', 'super_admin'), authorizePermissions('manageStaff'), getAllAttendance);

router.route('/monthly-summary')
  .get(authorizeRoles('admin', 'super_admin'), authorizePermissions('manageStaff'), getMonthlySummary);

module.exports = router;
