const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { getPublicMenu, createPublicOrder } = require('../controllers/publicController');

// PUBLIC (no auth). Tight rate limits on top of the global API limiter to curb
// abuse of these unauthenticated endpoints.
const menuLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
});
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many orders, please try again shortly.' },
});

router.get('/menu', menuLimiter, getPublicMenu);
router.post('/order', orderLimiter, createPublicOrder);

module.exports = router;
