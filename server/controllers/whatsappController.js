const asyncHandler = require('../utils/asyncHandler');
const Customer = require('../models/Customer');
const WaCampaign = require('../models/WaCampaign');
const WaAutomation = require('../models/WaAutomation');
const wa = require('../services/whatsappService');
const engine = require('../services/whatsappAutomation');
const { canAccessCafe, canAccessLocation, resolveUserCafeIds, userLocationIds, isAllLocation } = require('../utils/accessControl');

// Hard cap on a single broadcast so one click can't fan out unbounded on a
// serverless invocation (and to keep the messaging spend predictable).
const MAX_BROADCAST = 1000;

const SEGMENTS = ['all', 'new', 'active', 'atrisk', 'birthday'];

// Build the Customer query for a broadcast/audience preview, clamped to what the
// requesting user is allowed to see.
async function buildAudienceQuery(req, { cafeId, locationId, segment }) {
  const q = { phone: { $exists: true, $ne: '' }, marketingOptOut: { $ne: true } };
  const isSuper = req.user.role === 'super_admin';

  // Scope: a specific branch wins, then a cafe, else the user's whole tenant.
  if (locationId && !isAllLocation(locationId)) {
    if (!canAccessLocation(req.user, locationId)) { const e = new Error('Permission denied to this branch'); e.statusCode = 403; throw e; }
    q['memberships.branches'] = locationId;
  } else if (cafeId && !isAllLocation(cafeId)) {
    if (!canAccessCafe(req.user, cafeId)) { const e = new Error('Permission denied to this cafe'); e.statusCode = 403; throw e; }
    q['memberships.cafe'] = cafeId;
  } else if (!isSuper) {
    // No explicit scope: restrict to the user's cafes (or branches if branch-scoped).
    const cafeIds = await resolveUserCafeIds(req.user);
    if (cafeIds.length) q['memberships.cafe'] = { $in: cafeIds };
    else {
      const locIds = userLocationIds(req.user);
      q['memberships.branches'] = { $in: locIds };
    }
  }

  // Segment filter layered on top of scope.
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (segment === 'new') {
    q['memberships.status'] = 'new';
  } else if (segment === 'active') {
    q.lastVisit = { $gte: d30 };
  } else if (segment === 'atrisk') {
    q.lastVisit = { $lte: d30 };
  } else if (segment === 'birthday') {
    q.dobMonth = now.getMonth() + 1;
  }
  return q;
}

// @route GET /api/whatsapp/status
const getStatus = asyncHandler(async (req, res) => {
  const status = await wa.getStatus();
  res.json({ success: true, data: status });
});

// @route GET /api/whatsapp/templates
const getTemplates = asyncHandler(async (req, res) => {
  if (!wa.isConfigured()) {
    return res.json({ success: true, data: [], configured: false, missing: wa.missingEnv() });
  }
  try {
    const templates = await wa.listTemplates();
    res.json({ success: true, data: templates, configured: true });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message, data: [] });
  }
});

// @route POST /api/whatsapp/audience/preview  { cafeId?, locationId?, segment }
const previewAudience = asyncHandler(async (req, res) => {
  const { cafeId, locationId, segment = 'all' } = req.body || {};
  if (!SEGMENTS.includes(segment)) { res.status(400); throw new Error('Unknown segment'); }
  const q = await buildAudienceQuery(req, { cafeId, locationId, segment });
  const total = await Customer.countDocuments(q);
  const sample = await Customer.find(q).select('name phone').limit(5).lean();
  res.json({
    success: true,
    data: {
      total,
      sample: sample.map((c) => ({ name: c.name, phone: `••••••${String(c.phone).slice(-4)}` })),
    },
  });
});

// @route POST /api/whatsapp/broadcast
// body: { name, template, language, cafeId?, locationId?, segment, variables:[] }
const sendBroadcast = asyncHandler(async (req, res) => {
  if (!wa.isConfigured()) { res.status(400); throw new Error('WhatsApp is not configured yet. Add the API keys first.'); }
  const { name, template, language = 'en', cafeId, locationId, segment = 'all', variables = [] } = req.body || {};
  if (!template) { res.status(400); throw new Error('Choose a message template'); }
  if (!SEGMENTS.includes(segment)) { res.status(400); throw new Error('Unknown segment'); }

  const q = await buildAudienceQuery(req, { cafeId, locationId, segment });
  const customers = await Customer.find(q).select('name phone').limit(MAX_BROADCAST).lean();
  if (!customers.length) { res.status(400); throw new Error('No customers match this audience'); }

  const campaign = await WaCampaign.create({
    name: name || 'Broadcast',
    template, language, segment,
    cafe: cafeId && !isAllLocation(cafeId) ? cafeId : null,
    location: locationId && !isAllLocation(locationId) ? locationId : null,
    createdBy: req.user._id,
    source: 'broadcast',
    status: 'sending',
    counts: { total: customers.length, sent: 0, failed: 0, delivered: 0, read: 0 },
    recipients: [],
  });

  let sent = 0, failed = 0;
  const recipients = [];
  for (const c of customers) {
    // Per-recipient personalisation: {name} in any variable -> the first name.
    const vars = (variables || []).map((v) => engine.fillVar(v, c));
    try {
      const { wamid } = await wa.sendTemplate({ to: c.phone, template, language, variables: vars });
      recipients.push({ customer: c._id, name: c.name, phone: c.phone, wamid, status: 'sent' });
      sent += 1;
    } catch (err) {
      recipients.push({ customer: c._id, name: c.name, phone: c.phone, status: 'failed', error: err.message });
      failed += 1;
    }
  }

  await Customer.updateMany({ _id: { $in: customers.map((c) => c._id) } }, { $set: { lastMarketedAt: new Date() } });
  campaign.recipients = recipients;
  campaign.counts.sent = sent;
  campaign.counts.failed = failed;
  campaign.status = failed && !sent ? 'failed' : 'completed';
  await campaign.save();

  res.json({ success: true, data: { campaignId: campaign._id, total: customers.length, sent, failed } });
});

// @route GET /api/whatsapp/campaigns
const listCampaigns = asyncHandler(async (req, res) => {
  const isSuper = req.user.role === 'super_admin';
  const filter = {};
  if (!isSuper) {
    const cafeIds = await resolveUserCafeIds(req.user);
    filter.$or = [{ cafe: { $in: cafeIds } }, { createdBy: req.user._id }];
  }
  const campaigns = await WaCampaign.find(filter)
    .select('name template segment source trigger status counts createdAt cafe location')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ success: true, data: campaigns });
});

// @route GET /api/whatsapp/automations
const listAutomations = asyncHandler(async (req, res) => {
  const rules = await WaAutomation.find({}).sort({ trigger: 1 }).lean();
  res.json({ success: true, data: rules });
});

// @route PUT /api/whatsapp/automations
// body: { trigger, enabled, template, language, cafeId?, locationId?, inactiveDays? }
const upsertAutomation = asyncHandler(async (req, res) => {
  const { trigger, enabled, template, language = 'en', cafeId = null, locationId = null, inactiveDays } = req.body || {};
  if (!['welcome', 'birthday', 'winback', 'thankyou'].includes(trigger)) { res.status(400); throw new Error('Unknown trigger'); }

  // A global rule (no scope) is powerful — only super_admin may create one.
  const cafe = cafeId && !isAllLocation(cafeId) ? cafeId : null;
  const location = locationId && !isAllLocation(locationId) ? locationId : null;
  if (!cafe && !location && req.user.role !== 'super_admin') {
    res.status(403); throw new Error('Only a super admin can create an org-wide rule. Pick a cafe or branch.');
  }
  if (cafe && !canAccessCafe(req.user, cafe)) { res.status(403); throw new Error('Permission denied to this cafe'); }
  if (location && !canAccessLocation(req.user, location)) { res.status(403); throw new Error('Permission denied to this branch'); }
  if (enabled && !template) { res.status(400); throw new Error('Pick a template before enabling this automation'); }

  const set = { enabled: !!enabled, template: template || '', language, updatedBy: req.user._id };
  if (trigger === 'winback' && inactiveDays) set.inactiveDays = Math.max(7, Math.min(365, Number(inactiveDays)));

  const rule = await WaAutomation.findOneAndUpdate(
    { trigger, cafe, location },
    { $set: set, $setOnInsert: { trigger, cafe, location, createdBy: req.user._id } },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ success: true, data: rule });
});

// @route POST /api/whatsapp/automations/run   (cron or super_admin)
// Runs the scheduled triggers (birthday + win-back). Auth: either an authenticated
// super_admin OR a matching x-cron-key header (for an unattended scheduler).
const runScheduled = asyncHandler(async (req, res) => {
  const cronKey = process.env.CRON_SECRET;
  const headerKey = req.get('x-cron-key');
  const viaCron = cronKey && headerKey && headerKey === cronKey;
  const viaAdmin = req.user && req.user.role === 'super_admin';
  if (!viaCron && !viaAdmin) { res.status(403); throw new Error('Not authorised to run automations'); }

  const only = req.query.trigger;
  const triggers = only ? [only] : ['birthday', 'winback'];
  const results = [];
  for (const t of triggers) {
    if (!['birthday', 'winback'].includes(t)) continue;
    results.push(await engine.runScheduled(t));
  }
  res.json({ success: true, data: results });
});

// @route GET /api/whatsapp/webhook  (Meta subscription handshake — PUBLIC)
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

// @route POST /api/whatsapp/webhook  (delivery receipts + inbound msgs — PUBLIC)
const receiveWebhook = asyncHandler(async (req, res) => {
  // Ack immediately regardless — Meta retries on non-200 and we never want to
  // block their queue on our processing.
  if (!wa.verifySignature(req.rawBody, req.get('x-hub-signature-256'))) {
    return res.sendStatus(403);
  }
  res.sendStatus(200);

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        // 1) Delivery / read receipts -> update the matching campaign recipient.
        for (const st of value.statuses || []) {
          const wamid = st.id;
          const status = st.status; // sent | delivered | read | failed
          if (!wamid || !status) continue;
          const campaign = await WaCampaign.findOne({ 'recipients.wamid': wamid });
          if (!campaign) continue;
          const r = campaign.recipients.find((x) => x.wamid === wamid);
          if (r && r.status !== status) {
            r.status = status;
            campaign.counts.delivered = campaign.recipients.filter((x) => ['delivered', 'read'].includes(x.status)).length;
            campaign.counts.read = campaign.recipients.filter((x) => x.status === 'read').length;
            await campaign.save();
          }
        }

        // 2) Inbound messages -> honour STOP/UNSUBSCRIBE opt-outs.
        for (const msg of value.messages || []) {
          const from = msg.from;
          const text = (msg.text?.body || '').trim().toUpperCase();
          if (from && ['STOP', 'UNSUBSCRIBE', 'STOP PROMOTIONS'].includes(text)) {
            const last10 = from.slice(-10);
            await Customer.updateOne(
              { phone: new RegExp(`${last10}$`) },
              { $set: { marketingOptOut: true, marketingOptOutAt: new Date() } }
            );
          }
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp webhook] processing error:', err.message);
  }
});

module.exports = {
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
};
