// WhatsApp automation engine. Two flavours of trigger:
//   • event-based  (welcome, thankyou) — fired inline from the app, best-effort.
//   • scheduled    (birthday, winback)  — run daily by a cron hitting
//                    POST /api/whatsapp/automations/run.
//
// A rule maps a trigger + scope (cafe / branch / global) to an approved template.
// Every automated send skips opted-out customers and those without a phone.

const Customer = require('../models/Customer');
const WaAutomation = require('../models/WaAutomation');
const WaCampaign = require('../models/WaCampaign');
const wa = require('./whatsappService');

// Safety cap per scheduled run so a serverless invocation can't run unbounded.
const MAX_PER_RUN = 500;

// Personalise a template variable: the literal token {name} becomes the customer's
// first name; anything else is passed through verbatim.
const fillVar = (value, customer) => {
  const first = (customer.name || 'there').trim().split(/\s+/)[0];
  return String(value ?? '').replace(/\{name\}/gi, first);
};

// Find the rule that governs a trigger for a given cafe/branch: the most specific
// enabled rule wins (branch > cafe > global).
async function resolveRule(trigger, { cafe, location } = {}) {
  const rules = await WaAutomation.find({ trigger, enabled: true }).lean();
  if (!rules.length) return null;
  const score = (r) => (r.location ? 2 : 0) + (r.cafe ? 1 : 0);
  const matches = rules.filter((r) => {
    if (r.location) return location && String(r.location) === String(location);
    if (r.cafe) return cafe && String(r.cafe) === String(cafe);
    return true; // global
  });
  matches.sort((a, b) => score(b) - score(a));
  return matches[0] || null;
}

// EVENT: a customer just completed their profile. Best-effort — never throws.
async function fireWelcome(customer) {
  try {
    if (!wa.isConfigured() || !customer?.phone || customer.marketingOptOut) return;
    const cafe = customer.memberships?.[0]?.cafe || null;
    const location = customer.memberships?.[0]?.firstBranch || customer.branch || null;
    const rule = await resolveRule('welcome', { cafe, location });
    if (!rule || !rule.template) return;
    await wa.sendTemplate({
      to: customer.phone,
      template: rule.template,
      language: rule.language || 'en',
      variables: [fillVar('{name}', customer)],
    });
    await WaAutomation.updateOne({ _id: rule._id }, { $set: { lastRunAt: new Date() }, $inc: { lastRunCount: 1 } });
  } catch (err) {
    console.error('[whatsappAutomation] welcome failed:', err.message);
  }
}

// EVENT: a customer's order was completed. Best-effort — never throws.
async function fireThankYou(customer, { cafe, location } = {}) {
  try {
    if (!wa.isConfigured() || !customer?.phone || customer.marketingOptOut) return;
    const rule = await resolveRule('thankyou', { cafe, location });
    if (!rule || !rule.template) return;
    await wa.sendTemplate({
      to: customer.phone,
      template: rule.template,
      language: rule.language || 'en',
      variables: [fillVar('{name}', customer)],
    });
    await WaAutomation.updateOne({ _id: rule._id }, { $set: { lastRunAt: new Date() }, $inc: { lastRunCount: 1 } });
  } catch (err) {
    console.error('[whatsappAutomation] thankyou failed:', err.message);
  }
}

// Build the Customer query for a scheduled rule's scope.
const scopeQuery = (rule) => {
  const q = { phone: { $exists: true, $ne: '' }, marketingOptOut: { $ne: true } };
  if (rule.location) q['memberships.branches'] = rule.location;
  else if (rule.cafe) q['memberships.cafe'] = rule.cafe;
  return q;
};

// SCHEDULED: send today's birthday / win-back messages for every enabled rule of
// the given trigger. Returns a summary. Logs one WaCampaign per rule that sent.
async function runScheduled(trigger) {
  if (!['birthday', 'winback'].includes(trigger)) throw new Error('Not a scheduled trigger');
  if (!wa.isConfigured()) return { configured: false, sent: 0 };

  const rules = await WaAutomation.find({ trigger, enabled: true, template: { $ne: '' } }).lean();
  const now = new Date();
  let totalSent = 0;
  const runs = [];

  for (const rule of rules) {
    const q = scopeQuery(rule);
    if (trigger === 'birthday') {
      q.dobMonth = now.getMonth() + 1;
      q.dobDay = now.getDate();
    } else {
      const cutoff = new Date(now.getTime() - rule.inactiveDays * 24 * 60 * 60 * 1000);
      q.lastVisit = { $lte: cutoff };
      // Don't re-nag: skip anyone marketed within the inactivity window.
      q.$or = [{ lastMarketedAt: null }, { lastMarketedAt: { $lte: cutoff } }];
    }

    const customers = await Customer.find(q).limit(MAX_PER_RUN).lean();
    if (!customers.length) {
      await WaAutomation.updateOne({ _id: rule._id }, { $set: { lastRunAt: now, lastRunCount: 0 } });
      continue;
    }

    const recipients = [];
    let sent = 0, failed = 0;
    for (const c of customers) {
      try {
        const { wamid } = await wa.sendTemplate({
          to: c.phone,
          template: rule.template,
          language: rule.language || 'en',
          variables: [fillVar('{name}', c)],
        });
        recipients.push({ customer: c._id, name: c.name, phone: c.phone, wamid, status: 'sent' });
        sent += 1;
      } catch (err) {
        recipients.push({ customer: c._id, name: c.name, phone: c.phone, status: 'failed', error: err.message });
        failed += 1;
      }
    }

    const ids = customers.map((c) => c._id);
    await Customer.updateMany({ _id: { $in: ids } }, { $set: { lastMarketedAt: now } });

    await WaCampaign.create({
      name: trigger === 'birthday' ? 'Birthday automation' : 'Win-back automation',
      template: rule.template,
      language: rule.language || 'en',
      segment: trigger,
      cafe: rule.cafe || null,
      location: rule.location || null,
      createdBy: rule.createdBy || rule.updatedBy,
      source: 'automation',
      trigger,
      status: 'completed',
      counts: { total: customers.length, sent, failed, delivered: 0, read: 0 },
      recipients,
    });

    await WaAutomation.updateOne({ _id: rule._id }, { $set: { lastRunAt: now, lastRunCount: sent } });
    totalSent += sent;
    runs.push({ ruleId: rule._id, trigger, matched: customers.length, sent, failed });
  }

  return { configured: true, trigger, totalSent, runs };
}

module.exports = { fireWelcome, fireThankYou, runScheduled, resolveRule, fillVar, MAX_PER_RUN };
