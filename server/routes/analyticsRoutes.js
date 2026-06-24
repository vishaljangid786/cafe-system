const express = require('express');
const {
  getLocationAnalytics,
  getAllAnalytics,
  compareLocations,
  getAdvancedAnalytics,
  getLocationComparison,
  getTopLocations,
  getTrendingItems,
  getUnderperformingLocations,
  getProductPerformance,
  getComparisonDetails,
  getLocationInfo,
  getStaffReports,
  getPaymentInfo,
  getBranchComparisonSuite,
  getCommandCenterStats,
  getForecastingAnalytics
} = require('../controllers/analyticsController');
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);
router.use(checkPermissions('viewAnalytics'));

router.route('/advanced')
  .get(checkRoles('admin', 'super_admin', 'branch_admin', 'location_admin'), getAdvancedAnalytics);

// Per-location metrics; controller enforces canAccessLocation, so the blanket
// viewAnalytics gating above is sufficient.
router.route('/location')
  .get(getLocationAnalytics);

// Global/cross-location aggregates — admin-scoped like neighboring suites.
router.route('/all')
  .get(checkRoles('admin', 'super_admin', 'branch_admin', 'location_admin'), getAllAnalytics);

router.route('/compare-locations')
  .get(checkRoles('admin', 'super_admin', 'branch_admin', 'location_admin'), compareLocations);

router.route('/top-locations')
  .get(checkRoles('admin', 'super_admin', 'branch_admin', 'location_admin'), getTopLocations);

router.route('/underperforming-locations')
  .get(checkRoles('admin', 'super_admin', 'branch_admin', 'location_admin'), getUnderperformingLocations);

// Trending items / product performance scope via the controller's location checks.
router.route('/trending-items')
  .get(getTrendingItems);

router.route('/product-performance/:locationId')
  .get(getProductPerformance);

// Analytics pages are governed by the blanket viewAnalytics permission above,
// so any user granted viewAnalytics (not just admins) can open them.
router.route('/location-comparison')
  .get(getLocationComparison);

// Governed by the blanket viewAnalytics permission above (like the other analytics
// pages). The previous extra checkRoles 403'd any delegated non-admin granted
// viewAnalytics, even though the sidebar surfaced the page to them.
router.route('/staff-reports')
  .get(getStaffReports);

router.route('/payment-intelligence')
  .get(getPaymentInfo);

router.route('/branch-comparison-suite')
  .get(getBranchComparisonSuite);

router.route('/command-center')
  .get(getCommandCenterStats);

router.route('/forecasting')
  .get(getForecastingAnalytics);

router.route('/location-intelligence/:id')
  .get(checkRoles('admin', 'super_admin'), getLocationInfo);

router.route('/comparison-details')
  .get(getComparisonDetails);

module.exports = router;
