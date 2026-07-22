// Batched, resumable sender for WhatsApp campaigns.
//
// Why: a broadcast to hundreds/thousands of customers cannot be sent in one
// serverless invocation (it would blow the function timeout). Instead the
// campaign is snapshotted with every recipient marked 'queued', and this module
// drains that queue one bounded BATCH at a time — bounded by both a wall-clock
// budget and a max count. The caller (a request, the browser's resume loop, or a
// cron sweep) can keep calling until `remaining` hits 0.

const WaCampaign = require('../models/WaCampaign');
const Customer = require('../models/Customer');
const wa = require('./whatsappService');
const { fillVar } = require('./whatsappAutomation');

const DEFAULT_BUDGET_MS = 8000; // stay well under the serverless function limit
const DEFAULT_MAX_COUNT = 300;

// Send the next queued batch for one campaign. Mutates + saves the campaign.
// Returns { sent, failed, remaining, done }.
async function dispatchCampaign(campaignId, { budgetMs = DEFAULT_BUDGET_MS, maxCount = DEFAULT_MAX_COUNT } = {}) {
  const campaign = await WaCampaign.findById(campaignId);
  if (!campaign) return { sent: 0, failed: 0, remaining: 0, done: true };
  if (campaign.status === 'completed') return { sent: 0, failed: 0, remaining: 0, done: true };

  const start = Date.now();
  let sent = 0, failed = 0, processed = 0;
  const marketedIds = [];

  for (const r of campaign.recipients) {
    if (r.status !== 'queued') continue;
    if (processed >= maxCount || Date.now() - start > budgetMs) break;
    processed += 1;
    const vars = (campaign.variables || []).map((v) => fillVar(v, { name: r.name }));
    try {
      const { wamid } = await wa.sendTemplate({ to: r.phone, template: campaign.template, language: campaign.language, variables: vars });
      r.wamid = wamid;
      r.status = 'sent';
      sent += 1;
      if (r.customer) marketedIds.push(r.customer);
    } catch (err) {
      r.status = 'failed';
      r.error = err.message;
      failed += 1;
    }
  }

  const remaining = campaign.recipients.filter((r) => r.status === 'queued').length;
  const anySent = campaign.recipients.some((r) => r.status !== 'queued' && r.status !== 'failed');
  campaign.counts.sent = campaign.recipients.filter((r) => ['sent', 'delivered', 'read'].includes(r.status)).length;
  campaign.counts.failed = campaign.recipients.filter((r) => r.status === 'failed').length;
  campaign.status = remaining > 0 ? 'sending' : (anySent ? 'completed' : 'failed');
  await campaign.save();

  if (marketedIds.length) {
    await Customer.updateMany({ _id: { $in: marketedIds } }, { $set: { lastMarketedAt: new Date() } });
  }

  return { sent, failed, remaining, done: remaining === 0 };
}

// Cron/safety-net sweep: advance every still-sending campaign by one batch,
// oldest first, within an overall budget.
async function sweepPending({ budgetMs = 20000, perCampaign = 150 } = {}) {
  if (!wa.isConfigured()) return { swept: 0 };
  const start = Date.now();
  const pending = await WaCampaign.find({ status: 'sending', 'recipients.status': 'queued' })
    .sort({ createdAt: 1 }).select('_id').limit(50).lean();
  let swept = 0, totalSent = 0;
  for (const c of pending) {
    if (Date.now() - start > budgetMs) break;
    const r = await dispatchCampaign(c._id, { budgetMs: Math.min(6000, budgetMs), maxCount: perCampaign });
    totalSent += r.sent;
    swept += 1;
  }
  return { swept, totalSent };
}

module.exports = { dispatchCampaign, sweepPending, DEFAULT_BUDGET_MS, DEFAULT_MAX_COUNT };
