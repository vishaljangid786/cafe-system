const express = require('express');
const router = express.Router();
const {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon
} = require('../controllers/couponController');
const { verifyToken, checkRoles, checkPermissions, checkAction } = require('../middlewares/authMiddleware');
const { couponSchema, validate } = require('../middlewares/validateMiddleware');

router.use(verifyToken);

// Permission-driven: granting manageCoupons unlocks coupon management for any
// role; the granular coupons.* actions still pass for manageCoupons holders.
router.route('/')
  .get(checkPermissions('manageCoupons'), getCoupons)
  .post(checkAction('coupons.add'), ...couponSchema, validate, createCoupon);

router.post('/apply', checkPermissions('manageOrders'), applyCoupon);

router.route('/:id')
  .get(checkPermissions('manageCoupons'), getCoupon)
  .put(checkAction('coupons.modify'), ...couponSchema, validate, updateCoupon)
  .delete(checkAction('coupons.delete'), deleteCoupon);

module.exports = router;
