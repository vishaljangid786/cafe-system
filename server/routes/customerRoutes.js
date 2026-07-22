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
  getCustomerInsights,
  updateCustomer,
  getCustomerBirthdays,
  getDiscountConfig,
  updateDiscountConfig,
  generateBirthdayCampaign,
  listCampaigns,
  updateCampaign,
  deleteCustomer,
} = require('../controllers/customerController');
const { verifyToken, checkRoles, checkAction } = require('../middlewares/authMiddleware');
const { cacheGet } = require('../utils/cache');

router.use(verifyToken);
router.use(checkRoles('admin', 'super_admin', 'branch_admin', 'location_admin'));

// Static paths MUST be registered before '/:id', which would otherwise swallow
// '/report', '/summary', '/birthdays' and '/discount-config' as ids.
// The CRM dashboard fires these three on every open — a 60s per-user cache
// removes the repeat aggregation cost (no-ops without REDIS_URL).
router.route('/analytics').get(cacheGet(60), getCustomerAnalytics);
router.route('/top').get(cacheGet(60), getTopCustomers);
router.route('/inactive').get(cacheGet(60), getInactiveCustomers);
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
router.route('/:id/insights').get(getCustomerInsights);
router.route('/:id')
  .get(getCustomerById)
  .patch(checkAction('customers.modify'), updateCustomer)
  // Belt and braces: checkAction gates the ROUTE, assertCanDelete inside the
  // controller re-checks it against the record the id actually resolves to.
  .delete(checkAction('customers.delete'), deleteCustomer);

module.exports = router;
