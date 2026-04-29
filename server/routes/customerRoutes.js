const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getTopCustomers,
  getInactiveCustomers,
  getCustomerAnalytics
} = require('../controllers/customerController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(authorizeRoles('admin', 'super_admin'));

router.route('/analytics').get(getCustomerAnalytics);
router.route('/top').get(getTopCustomers);
router.route('/inactive').get(getInactiveCustomers);
router.route('/').get(getCustomers);

module.exports = router;
