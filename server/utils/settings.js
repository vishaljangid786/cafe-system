// Resolved configuration helper. Returns the effective settings for a branch by
// layering: code DEFAULTS  <  global settings doc  <  branch settings doc.
// Any code that needs a configurable value (GST %, shift, loyalty, payroll rules,
// invoice numbering) should read it from here instead of hardcoding.

const DEFAULTS = {
  tax: { gstRate: 5, gstin: '' },
  payroll: {
    shiftStart: '09:00',
    graceMinutes: 10,
    standardDayMinutes: 480,
    overtimeMultiplier: 1.5,
    latePenaltyGroup: 3,
    latePenaltyDayUnit: 0.5,
    halfDayThresholdMinutes: 240,
  },
  loyalty: {
    pointsPer100: 1,
    rewardThresholdPoints: 100,
    rewardCouponValue: 100,
    rewardMinOrder: 300,
    rewardExpiryDays: 30,
    tierSilver: 5000,
    tierGold: 20000,
    tierPlatinum: 50000,
  },
  invoice: { prefix: 'INV', nextNumber: 1 },
  // autoSettleOnComplete: when true (default, preserving legacy behavior) an order
  // that is still 'unpaid' at completion is assumed paid in full (amountPaid =
  // grandTotal). Set false for branches that complete-then-collect (e.g. running
  // tabs / credit) so completing an order does NOT book phantom cash into the
  // drawer — the order stays 'unpaid' until a real payment is recorded.
  billing: { serviceChargeRate: 0, roundBill: true, autoSettleOnComplete: true },
  general: { currency: 'INR', timezone: 'Asia/Kolkata' },
  // QR / self-order payment config. upiVpa + upiName build the upi:// intent the
  // customer scans to prepay. Toggles decide which options the scan page offers.
  payments: {
    upiVpa: '',
    upiName: '',
    acceptUpi: true,
    acceptCash: true,
    requireApprovalForQr: true,
  },
};

// Shallow-merge each known group so a branch doc that only sets `tax` still
// inherits `payroll`/`loyalty`/etc. from global/defaults.
const mergeGroups = (...sources) => {
  const out = {};
  for (const group of Object.keys(DEFAULTS)) {
    out[group] = { ...DEFAULTS[group] };
    for (const src of sources) {
      if (src && src[group] && typeof src[group] === 'object') {
        for (const [k, v] of Object.entries(src[group])) {
          if (v !== undefined && v !== null) out[group][k] = v;
        }
      }
    }
  }
  return out;
};

const getSettings = async (locationId = null) => {
  const Settings = require('../models/Settings');
  // Do NOT swallow query errors: on a money path we must fail loudly rather than
  // silently bill/pay with hardcoded defaults instead of the org's configured rates.
  const [globalDoc, branchDoc] = await Promise.all([
    Settings.findOne({ locationId: null }).lean(),
    locationId ? Settings.findOne({ locationId }).lean() : null,
  ]);
  return mergeGroups(globalDoc, branchDoc);
};

// Coerce a configured numeric value, preserving a legitimate 0 (unlike `x || d`,
// which wrongly discards 0/false). Falls back only for null/undefined/''/NaN.
const num = (v, fallback) => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Derive a customer's membership tier from lifetime spend + configured thresholds.
const loyaltyTier = (totalSpend = 0, loyaltyCfg = DEFAULTS.loyalty) => {
  const spend = Number(totalSpend) || 0;
  if (spend >= (Number(loyaltyCfg.tierPlatinum) || Infinity)) return 'Platinum';
  if (spend >= (Number(loyaltyCfg.tierGold) || Infinity)) return 'Gold';
  if (spend >= (Number(loyaltyCfg.tierSilver) || Infinity)) return 'Silver';
  return 'Bronze';
};

module.exports = { getSettings, DEFAULTS, num, loyaltyTier };
