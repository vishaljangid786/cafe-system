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
  getStaffReportDetail,
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

// Analytics pages are governed by the blanket viewAnalytics permission above,
// so any user granted viewAnalytics (not just admins) can open them.
router.route('/location-comparison')
  .get(getLocationComparison);

router.route('/staff-reports')
  .get(checkRoles('branch_admin', 'location_admin', 'admin', 'super_admin'), getStaffReports);

router.route('/staff-reports/:id')
  .get(checkRoles('branch_admin', 'location_admin', 'admin', 'super_admin'), getStaffReportDetail);

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
