const express = require('express');
const {
  getLocationSalary,
  getAllSalary,
  getUserSalary,
} = require('../controllers/salaryController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/branch')
  .get(authorizeRoles('branch_admin', 'admin', 'super_admin'), getLocationSalary);

router.route('/all')
  .get(authorizeRoles('admin', 'super_admin'), getAllSalary);

router.route('/user/:id')
  .get(authorizeRoles('branch_admin', 'admin', 'super_admin'), getUserSalary);

module.exports = router;
