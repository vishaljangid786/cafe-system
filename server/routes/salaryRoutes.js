const {
  getLocationSalary,
  getAllSalary,
  getUserSalary,
  getMySalaryHistory,
  getMySalary,
  generatePayroll,
  adjustPayroll,
  approvePayroll,
  deletePayroll,
  getPayrollHistory
} = require('../controllers/salaryController');
const { verifyToken, checkRoles, checkPermissions, checkAction } = require('../middlewares/authMiddleware');
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
  .post(checkAction('salaries.add'), generatePayroll);

router.route('/payroll/history')
  .get(checkRoles('branch_admin', 'admin', 'super_admin'), checkPermissions('manageStaff'), getPayrollHistory);

router.route('/payroll/:id/adjust')
  .patch(checkAction('salaries.modify'), adjustPayroll);

router.route('/payroll/:id/approve')
  .patch(checkAction('salaries.approve'), approvePayroll);

// Delete a payroll record. Registered under /payroll/:id for symmetry with the
// other payroll mutations, and at the bare /:id the client uses. Both carry
// checkAction; deletePayroll re-checks the permission AND the record's branch.
// Declared last so the literal paths above ('/all', '/generate', …) always win.
router.route('/payroll/:id')
  .delete(checkAction('salaries.delete'), deletePayroll);

router.route('/:id')
  .delete(checkAction('salaries.delete'), deletePayroll);

module.exports = router;
