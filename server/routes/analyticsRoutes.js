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
const { verifyToken, authorizeRoles, authorizePermissions } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);
router.use(authorizePermissions('viewAnalytics'));

router.route('/advanced')
  .get(authorizeRoles('admin', 'super_admin', 'branch_admin'), getAdvancedAnalytics);

router.route('/location-comparison')
  .get(authorizeRoles('admin', 'super_admin'), getLocationComparison);

router.route('/staff-reports')
  .get(authorizeRoles('branch_admin', 'admin', 'super_admin'), getStaffReports);

router.route('/payment-intelligence')
  .get(authorizeRoles('admin', 'super_admin'), getPaymentInfo);

router.route('/branch-comparison-suite')
  .get(authorizeRoles('admin', 'super_admin'), getBranchComparisonSuite);

router.route('/command-center')
  .get(authorizeRoles('admin', 'super_admin'), getCommandCenterStats);

router.route('/forecasting')
  .get(authorizeRoles('admin', 'super_admin'), getForecastingAnalytics);

module.exports = router;
