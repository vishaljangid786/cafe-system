const {
  getLocationSalary,
  getAllSalary,
  getUserSalary,
  getMySalaryHistory,
  getMySalary,
  generatePayroll,
  approvePayroll,
  getPayrollHistory
} = require('../controllers/salaryController');
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');
const express = require('express')

const router = express.Router();

router.use(verifyToken);

router.route('/my').get(getMySalary);
router.route('/my-history').get(getMySalaryHistory);

router.route('/location')
  .get(checkRoles('branch_admin', 'location_admin', 'admin', 'super_admin'), checkPermissions('manageStaff'), getLocationSalary);

router.route('/all')
  .get(checkRoles('admin', 'super_admin'), checkPermissions('manageStaff'), getAllSalary);

router.route('/user/:id')
  .get(checkRoles('branch_admin', 'location_admin', 'admin', 'super_admin'), checkPermissions('manageStaff'), getUserSalary);

router.route('/generate')
  .post(checkRoles('branch_admin', 'admin', 'super_admin'), checkPermissions('manageStaff'), generatePayroll);

router.route('/payroll/history')
  .get(checkRoles('branch_admin', 'admin', 'super_admin'), checkPermissions('manageStaff'), getPayrollHistory);

router.route('/payroll/:id/approve')
  .patch(checkRoles('branch_admin', 'admin', 'super_admin'), checkPermissions('manageStaff'), approvePayroll);

module.exports = router;
