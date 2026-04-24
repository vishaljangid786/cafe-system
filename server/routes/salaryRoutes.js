const {
  getLocationSalary,
  getAllSalary,
  getUserSalary,
  getMySalaryHistory,
  getMySalary
} = require('../controllers/salaryController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const express = require('express')

const router = express.Router();

router.use(verifyToken);

router.route('/my').get(getMySalary);
router.route('/my-history').get(getMySalaryHistory);
router.route('/location')
  .get(authorizeRoles('branch_admin', 'admin', 'super_admin'), getLocationSalary);

router.route('/all')
  .get(authorizeRoles('admin', 'super_admin'), getAllSalary);

router.route('/user/:id')
  .get(authorizeRoles('branch_admin', 'admin', 'super_admin'), getUserSalary);

module.exports = router;
