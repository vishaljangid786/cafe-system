const express = require('express');
const {
  getLocationAnalytics,
  getAllAnalytics,
  compareLocations,
} = require('../controllers/analyticsController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/branch')
  .get(authorizeRoles('branch_admin', 'admin', 'super_admin'), getLocationAnalytics);

router.route('/all')
  .get(authorizeRoles('admin', 'super_admin'), getAllAnalytics);

router.route('/compare-branches')
  .get(authorizeRoles('admin', 'super_admin'), compareLocations);

module.exports = router;
