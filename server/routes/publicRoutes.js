const express = require('express');
const rateLimit = require('express-rate-limit');
const { withRateLimitStore } = require('../utils/rateLimitStore');
const router = express.Router();
const {
  getPublicMenu,
  createPublicOrder,
  getPublicOrderStatus,
  getPublicCustomerMe,
  upsertPublicCustomerProfile,
  patchPublicCustomerProfile,
  skipPublicCustomerProfile,
} = require('../controllers/publicController');

// PUBLIC (no auth). Tight rate limits on top of the global API limiter to curb
// abuse of these unauthenticated endpoints.
const menuLimiter = rateLimit(withRateLimitStore({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
}, 'public-menu'));
const orderLimiter = rateLimit(withRateLimitStore({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many orders, please try again shortly.' },
}, 'public-order'));

// Status polling — allow a generous cadence since the scan page polls every few
// seconds while it waits for staff to confirm the payment.
const statusLimiter = rateLimit(withRateLimitStore({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
}, 'public-status'));

// Customer self-registration. Reads are token-gated (no phone->profile lookup
// exists at all), and the WRITES get their own tighter limiter so the profile
// endpoints can't be hammered to probe for registered numbers.
const customerWriteLimiter = rateLimit(withRateLimitStore({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again shortly.' },
}, 'public-customer-write'));

router.get('/menu', menuLimiter, getPublicMenu);
router.post('/order', orderLimiter, createPublicOrder);
router.get('/order/:id', statusLimiter, getPublicOrderStatus);

router.get('/customer/me', menuLimiter, getPublicCustomerMe);
router.post('/customer/profile', customerWriteLimiter, upsertPublicCustomerProfile);
router.patch('/customer/profile', customerWriteLimiter, patchPublicCustomerProfile);
router.post('/customer/skip', customerWriteLimiter, skipPublicCustomerProfile);

module.exports = router;
