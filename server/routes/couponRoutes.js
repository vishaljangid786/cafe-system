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
const { verifyToken, authorizeRoles, authorizePermissions } = require('../middlewares/authMiddleware');
const { couponSchema, validate } = require('../middlewares/validateMiddleware');

router.use(verifyToken);

router.route('/')
  .get(authorizeRoles('super_admin', 'admin', 'branch_admin'), authorizePermissions('manageCoupons'), getCoupons)
  .post(authorizeRoles('super_admin', 'admin'), authorizePermissions('manageCoupons'), ...couponSchema, validate, createCoupon);

router.post('/apply', applyCoupon);

router.route('/:id')
  .get(authorizePermissions('manageCoupons'), getCoupon)
  .put(authorizeRoles('super_admin', 'admin'), authorizePermissions('manageCoupons'), ...couponSchema, validate, updateCoupon)
  .delete(authorizeRoles('super_admin', 'admin'), authorizePermissions('manageCoupons'), deleteCoupon);

module.exports = router;
