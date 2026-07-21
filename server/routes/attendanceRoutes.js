const express = require('express');
const {
  markAttendance,
  getLocationAttendance,
  getAllAttendance,
  getMonthlySummary,
  getMyAttendance,
  checkIn,
  checkOut,
  deleteAttendance,
} = require('../controllers/attendanceController');
const { verifyToken, checkRoles, checkPermissions, checkAction } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/my')
  .get(getMyAttendance);

// Self-service clock-in / clock-out (any authenticated staff member, for themselves)
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);

router.route('/mark')
  .post(checkAction('attendance.add'), markAttendance);

router.route('/location')
  .get(checkRoles('branch_admin', 'location_admin', 'admin', 'super_admin'), checkPermissions('manageStaff'), getLocationAttendance);

router.route('/all')
  .get(checkRoles('admin', 'super_admin'), checkPermissions('manageStaff'), getAllAttendance);

router.route('/monthly-summary')
  .get(checkRoles('admin', 'super_admin'), checkPermissions('manageStaff'), getMonthlySummary);

// Declared last so it can never shadow the named routes above. checkAction is the
// first gate; the controller re-checks it together with the record's branch scope.
router.route('/:id')
  .delete(checkAction('attendance.delete'), deleteAttendance);

module.exports = router;
