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
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');
const { couponSchema, validate } = require('../middlewares/validateMiddleware');

router.use(verifyToken);

// Permission-driven: granting manageCoupons unlocks coupon management for any
// role (super_admin bypasses; admin holds it by default). Previously checkRoles
// hard-blocked branch_admin/staff even when granted the permission.
router.route('/')
  .get(checkPermissions('manageCoupons'), getCoupons)
  .post(checkPermissions('manageCoupons'), ...couponSchema, validate, createCoupon);

router.post('/apply', applyCoupon);

router.route('/:id')
  .get(checkPermissions('manageCoupons'), getCoupon)
  .put(checkPermissions('manageCoupons'), ...couponSchema, validate, updateCoupon)
  .delete(checkPermissions('manageCoupons'), deleteCoupon);

module.exports = router;
