const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { submitFeedback, getFeedback } = require('../controllers/feedbackController');
const { verifyToken, checkPermissions } = require('../middlewares/authMiddleware');

// Tight limiter for the PUBLIC (unauthenticated) submit endpoint to curb spam /
// rating-poisoning — on top of the global API limiter.
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions, please try again shortly.' },
});

// Public submission via QR / link (no login).
router.post('/', submitLimiter, submitFeedback);

// Admin view (branch-scoped) with rating stats.
router.get('/', verifyToken, checkPermissions('viewAnalytics'), getFeedback);

module.exports = router;
