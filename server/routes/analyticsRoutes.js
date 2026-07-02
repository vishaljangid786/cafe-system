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
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Analytics endpoints run heavy DB aggregations (forecasting, command-center,
// branch-comparison). Cap them below the global limiter to blunt a hammering DoS,
// while staying generous enough for a dashboard that fires several calls per load.
const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many analytics requests, please slow down.' },
});

router.use(verifyToken);
router.use(analyticsLimiter);
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
