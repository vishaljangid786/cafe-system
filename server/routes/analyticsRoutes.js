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
  .get(checkRoles('admin', 'super_admin', 'branch_admin'), getAdvancedAnalytics);

router.route('/location-comparison')
  .get(checkRoles('admin', 'super_admin'), getLocationComparison);

router.route('/staff-reports')
  .get(checkRoles('branch_admin', 'admin', 'super_admin'), getStaffReports);

router.route('/payment-intelligence')
  .get(checkRoles('admin', 'super_admin'), getPaymentInfo);

router.route('/branch-comparison-suite')
  .get(checkRoles('admin', 'super_admin'), getBranchComparisonSuite);

router.route('/command-center')
  .get(checkRoles('admin', 'super_admin'), getCommandCenterStats);

router.route('/forecasting')
  .get(checkRoles('admin', 'super_admin'), getForecastingAnalytics);

module.exports = router;
