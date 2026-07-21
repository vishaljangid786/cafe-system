const express = require('express');
const rateLimit = require('express-rate-limit');
const { withRateLimitStore } = require('../utils/rateLimitStore');
const router = express.Router();
const { submitFeedback, getFeedback, deleteFeedback } = require('../controllers/feedbackController');
const { verifyToken, checkPermissions, checkAction } = require('../middlewares/authMiddleware');

// Tight limiter for the PUBLIC (unauthenticated) submit endpoint to curb spam /
// rating-poisoning — on top of the global API limiter.
const submitLimiter = rateLimit(withRateLimitStore({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions, please try again shortly.' },
}, 'feedback-submit'));

// Public submission via QR / link (no login).
router.post('/', submitLimiter, submitFeedback);

// Admin view (branch-scoped) with rating stats.
router.get('/', verifyToken, checkPermissions('viewAnalytics'), getFeedback);

// Removing a review moves a branch's rating, so this sits behind login + the
// granular action — never the public submit path above. The controller re-checks
// the action AND the entry's branch, since middleware cannot see which record
// the :id resolves to.
router.delete('/:id', verifyToken, checkAction('feedback.delete'), deleteFeedback);

module.exports = router;
