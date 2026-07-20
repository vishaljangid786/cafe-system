// Resolved configuration helper. Returns the effective settings for a branch by
// layering: code DEFAULTS  <  global doc  <  CAFE doc  <  branch doc.
// Any code that needs a configurable value (GST %, shift, loyalty, payroll rules,
// invoice numbering, CRM discounts) should read it from here instead of hardcoding.
// The cafe tier is what lets a super admin configure any cafe, an admin their own,
// and a branch admin just their branch, through a single mechanism.

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
  // Customer CRM. The intro discount is granted once per customer PER CAFE and is
  // always computed server-side; askProfileOnScan drives the QR first-visit sheet.
  crm: {
    newCustomerDiscountEnabled: true,
    newCustomerDiscountPercent: 20,
    newCustomerMaxDiscount: null, // ₹ cap, null = uncapped
    newCustomerMinOrder: 0,
    askProfileOnScan: true,
    profileRequired: false, // false = customer can Skip
  },
};

// Shallow-merge each known group so a branch doc that only sets `tax` still
// inherits `payroll`/`loyalty`/etc. from the cafe/global/defaults beneath it.
// Also records which tier supplied each key, so the UI can show "inherited from…".
const mergeLayers = (layers) => {
  const settings = {};
  const sources = {};
  for (const group of Object.keys(DEFAULTS)) {
    settings[group] = { ...DEFAULTS[group] };
    for (const key of Object.keys(DEFAULTS[group])) sources[`${group}.${key}`] = 'default';
    for (const { level, doc } of layers) {
      if (doc && doc[group] && typeof doc[group] === 'object') {
        for (const [k, v] of Object.entries(doc[group])) {
          if (v !== undefined && v !== null) {
            settings[group][k] = v;
            sources[`${group}.${k}`] = level;
          }
        }
      }
    }
  }
  return { settings, sources };
};

// Back-compat shape used by the original two-arg callers.
const mergeGroups = (...docs) => mergeLayers(docs.map((doc) => ({ level: 'unknown', doc }))).settings;

// Load the raw docs for each tier. `locationId` resolves its own cafe unless one
// is passed explicitly (the settings UI asks for a cafe without a branch).
const loadLayers = async (locationId = null, explicitCafeId = null) => {
  const Settings = require('../models/Settings');
  const Location = require('../models/Location');

  let cafeId = explicitCafeId || null;
  if (!cafeId && locationId) {
    const loc = await Location.findById(locationId).select('cafe').lean();
    cafeId = loc?.cafe || null;
  }

  // NOTE: the global doc must be matched on BOTH nulls. Querying `{ locationId: null }`
  // alone would also match every cafe-tier doc (they all have locationId null) and
  // return an arbitrary one as "global".
  const [globalDoc, cafeDoc, branchDoc] = await Promise.all([
    Settings.findOne({ locationId: null, cafeId: null }).lean(),
    cafeId ? Settings.findOne({ locationId: null, cafeId }).lean() : null,
    locationId ? Settings.findOne({ locationId }).lean() : null,
  ]);

  return {
    cafeId,
    layers: [
      { level: 'global', doc: globalDoc },
      { level: 'cafe', doc: cafeDoc },
      { level: 'branch', doc: branchDoc },
    ],
  };
};

const getSettings = async (locationId = null) => {
  // Do NOT swallow query errors: on a money path we must fail loudly rather than
  // silently bill/pay with hardcoded defaults instead of the org's configured rates.
  const { layers } = await loadLayers(locationId);
  return mergeLayers(layers).settings;
};

// Same resolution, but also reports the tier each key came from. Used by the CRM
// discount-config screen to render "Currently inherited from: Global default".
const getSettingsWithSources = async ({ locationId = null, cafeId = null } = {}) => {
  const { layers, cafeId: resolvedCafeId } = await loadLayers(locationId, cafeId);
  const { settings, sources } = mergeLayers(layers);
  return { settings, sources, cafeId: resolvedCafeId };
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

module.exports = { getSettings, getSettingsWithSources, mergeGroups, DEFAULTS, num, loyaltyTier };
