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

router.route('/')
  .get(checkRoles('super_admin', 'admin', 'branch_admin'), checkPermissions('manageCoupons'), getCoupons)
  .post(checkRoles('super_admin', 'admin'), checkPermissions('manageCoupons'), ...couponSchema, validate, createCoupon);

router.post('/apply', applyCoupon);

router.route('/:id')
  .get(checkPermissions('manageCoupons'), getCoupon)
  .put(checkRoles('super_admin', 'admin'), checkPermissions('manageCoupons'), ...couponSchema, validate, updateCoupon)
  .delete(checkRoles('super_admin', 'admin'), checkPermissions('manageCoupons'), deleteCoupon);

module.exports = router;
