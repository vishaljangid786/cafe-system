const express = require('express');
const {
  markAttendance,
  getLocationAttendance,
  getAllAttendance,
  getMonthlySummary,
} = require('../controllers/attendanceController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/mark')
  .post(authorizeRoles('location_admin'), markAttendance);

router.route('/branch')
  .get(authorizeRoles('location_admin', 'admin', 'super_admin'), getLocationAttendance);

router.route('/all')
  .get(authorizeRoles('admin', 'super_admin'), getAllAttendance);

router.route('/monthly-summary')
  .get(authorizeRoles('admin', 'super_admin'), getMonthlySummary);

module.exports = router;
