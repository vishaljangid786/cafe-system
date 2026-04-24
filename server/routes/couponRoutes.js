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
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { couponSchema, validate } = require('../middlewares/validateMiddleware');

router.use(verifyToken);

router.route('/')
  .get(authorizeRoles('super_admin', 'admin', 'branch_admin'), getCoupons)
  .post(authorizeRoles('super_admin', 'admin'), ...couponSchema, validate, createCoupon);

router.post('/apply', applyCoupon);

router.route('/:id')
  .get(getCoupon)
  .put(authorizeRoles('super_admin', 'admin'), ...couponSchema, validate, updateCoupon)
  .delete(authorizeRoles('super_admin', 'admin'), deleteCoupon);

module.exports = router;
