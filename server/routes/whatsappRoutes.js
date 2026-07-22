const express = require('express');
const router = express.Router();
const {
  getStatus,
  getTemplates,
  previewAudience,
  sendBroadcast,
  listCampaigns,
  listAutomations,
  upsertAutomation,
  runScheduled,
  verifyWebhook,
  receiveWebhook,
} = require('../controllers/whatsappController');
const { verifyToken, optionalVerifyToken, checkAction } = require('../middlewares/authMiddleware');
const { userCanAct } = require('../utils/actionPermissions');

// Read access to the WhatsApp tab: whoever can send OR manage automations.
const requireWaAny = (req, res, next) => {
  if (userCanAct(req.user, 'customers.message') || userCanAct(req.user, 'customers.automate')) return next();
  res.status(403);
  return next(new Error('You do not have access to messaging'));
};

// ── PUBLIC: Meta webhook (subscription handshake + delivery/inbound events) ──
// Must NOT sit behind verifyToken — Meta calls these unauthenticated.
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

// ── Scheduled runner: an unattended cron (x-cron-key) OR a signed-in super admin.
// optionalVerifyToken populates req.user when a token is present but doesn't reject
// when it's absent (the cron has no session).
router.post('/automations/run', optionalVerifyToken, runScheduled);

// ── Everything else needs a session ─────────────────────────────────────────
router.use(verifyToken);

router.get('/status', requireWaAny, getStatus);
router.get('/templates', requireWaAny, getTemplates);
router.get('/campaigns', requireWaAny, listCampaigns);
router.post('/audience/preview', checkAction('customers.message'), previewAudience);
router.post('/broadcast', checkAction('customers.message'), sendBroadcast);

router.get('/automations', requireWaAny, listAutomations);
router.put('/automations', checkAction('customers.automate'), upsertAutomation);

module.exports = router;
