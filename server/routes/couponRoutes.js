const express = require('express');
const {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon,
} = require('../controllers/couponController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(authorizeRoles('super_admin', 'admin'), getCoupons)
  .post(authorizeRoles('super_admin', 'admin'), createCoupon);

router.route('/apply')
  .post(applyCoupon);

router.route('/:id')
  .put(authorizeRoles('super_admin', 'admin'), updateCoupon)
  .delete(authorizeRoles('super_admin', 'admin'), deleteCoupon);

module.exports = router;
