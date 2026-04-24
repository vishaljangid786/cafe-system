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
  getLocationIntelligence
} = require('../controllers/analyticsController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/location')
  .get(authorizeRoles('branch_admin', 'admin', 'super_admin'), getLocationAnalytics);

router.route('/all')
  .get(authorizeRoles('admin', 'super_admin'), getAllAnalytics);

router.route('/advanced')
  .get(authorizeRoles('admin', 'super_admin', 'branch_admin'), getAdvancedAnalytics);

router.route('/compare-locations')
  .get(authorizeRoles('admin', 'super_admin'), compareLocations);

router.route('/location-comparison')
  .get(authorizeRoles('admin', 'super_admin'), getLocationComparison);

router.route('/top-locations')
  .get(authorizeRoles('admin', 'super_admin'), getTopLocations);

router.route('/trending-items')
  .get(authorizeRoles('admin', 'super_admin'), getTrendingItems);

router.route('/underperforming-locations')
  .get(authorizeRoles('admin', 'super_admin'), getUnderperformingLocations);

router.route('/product-performance/:locationId')
  .get(authorizeRoles('admin', 'super_admin'), getProductPerformance);

router.route('/comparison-details')
  .get(authorizeRoles('admin', 'super_admin'), getComparisonDetails);

router.route('/location-intelligence/:id')
  .get(authorizeRoles('admin', 'super_admin'), getLocationIntelligence);

module.exports = router;
