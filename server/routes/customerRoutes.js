const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getTopCustomers,
  getInactiveCustomers,
  getCustomerAnalytics,
  getCustomerReport,
  getCustomerSummary,
  getCustomerById,
  getCustomerOrders,
  updateCustomer,
  getCustomerBirthdays,
  getDiscountConfig,
  updateDiscountConfig,
  generateBirthdayCampaign,
  listCampaigns,
  updateCampaign,
} = require('../controllers/customerController');
const { verifyToken, checkRoles, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(checkRoles('admin', 'super_admin', 'branch_admin', 'location_admin'));

// Static paths MUST be registered before '/:id', which would otherwise swallow
// '/report', '/summary', '/birthdays' and '/discount-config' as ids.
router.route('/analytics').get(getCustomerAnalytics);
router.route('/top').get(getTopCustomers);
router.route('/inactive').get(getInactiveCustomers);
router.route('/report').get(getCustomerReport);
router.route('/summary').get(getCustomerSummary);
router.route('/birthdays').get(getCustomerBirthdays);

router.route('/discount-config')
  .get(getDiscountConfig)
  .put(checkAction('customers.discount'), updateDiscountConfig);

router.route('/campaigns').get(listCampaigns);
router.route('/campaigns/birthday').post(checkAction('customers.campaign'), generateBirthdayCampaign);
router.route('/campaigns/:batchId').patch(checkAction('customers.campaign'), updateCampaign);

router.route('/').get(getCustomers);

// Parameterised routes last.
router.route('/:id/orders').get(getCustomerOrders);
router.route('/:id')
  .get(getCustomerById)
  .patch(checkAction('customers.modify'), updateCustomer);

module.exports = router;
