const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getTopCustomers,
  getInactiveCustomers,
  getCustomerAnalytics
} = require('../controllers/customerController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(checkRoles('admin', 'super_admin', 'branch_admin'));

router.route('/analytics').get(getCustomerAnalytics);
router.route('/top').get(getTopCustomers);
router.route('/inactive').get(getInactiveCustomers);
router.route('/').get(getCustomers);

module.exports = router;
