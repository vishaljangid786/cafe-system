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

// Coupons are ORG-WIDE (the model has no per-branch scoping), so creating/editing/
// deleting one affects every branch. Management is therefore restricted to org-level
// roles (super_admin / admin): the checkRoles gate runs BEFORE the action check so a
// branch-level role can't tamper with all cafes' promotions even if it is granted
// manageCoupons or a coupons.* action. Reads stay broad; applyCoupon (used while
// taking an order) is unchanged.
const couponManagers = checkRoles('super_admin', 'admin');
router.route('/')
  .get(checkPermissions('manageCoupons'), getCoupons)
  .post(couponManagers, checkAction('coupons.add'), ...couponSchema, validate, createCoupon);

router.post('/apply', checkPermissions('manageOrders'), applyCoupon);

router.route('/:id')
  .get(checkPermissions('manageCoupons'), getCoupon)
  .put(couponManagers, checkAction('coupons.modify'), ...couponSchema, validate, updateCoupon)
  .delete(couponManagers, checkAction('coupons.delete'), deleteCoupon);

module.exports = router;
