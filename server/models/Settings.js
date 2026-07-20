const mongoose = require('mongoose');

// Per-branch configuration. A document with locationId = null is the GLOBAL
// default; a branch document overrides the global per group. Code-level DEFAULTS
// (utils/settings.js) are the final fallback so the app works before any settings
// are saved. This replaces the hardcoded constants scattered across the app
// (GST %, shift start, late/overtime rules, loyalty rules, invoice numbering).
const settingsSchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null, // null = global default
    },

    // Cafe-level tier, sitting between global and branch in the merge chain:
    // DEFAULTS < global (both null) < cafe (cafeId set) < branch (locationId set).
    // This is what lets a super admin configure any cafe, an admin their own cafe,
    // and a branch admin just their branch — through one mechanism.
    cafeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      default: null,
      index: true,
    },

    tax: {
      gstRate: { type: Number, default: 5, min: 0, max: 100 }, // percent
      gstin: { type: String, default: '' },
    },

    payroll: {
      shiftStart: { type: String, default: '09:00' },      // HH:mm
      graceMinutes: { type: Number, default: 10, min: 0 },
      standardDayMinutes: { type: Number, default: 480, min: 0 }, // 8h
      overtimeMultiplier: { type: Number, default: 1.5, min: 1 },
      latePenaltyGroup: { type: Number, default: 3, min: 1 },     // N lates ...
      latePenaltyDayUnit: { type: Number, default: 0.5, min: 0 }, // ... = X days deducted
      halfDayThresholdMinutes: { type: Number, default: 240, min: 0 },
    },

    loyalty: {
      pointsPer100: { type: Number, default: 1, min: 0 },       // points earned per ₹100
      rewardThresholdPoints: { type: Number, default: 100, min: 1 },
      rewardCouponValue: { type: Number, default: 100, min: 0 },
      rewardMinOrder: { type: Number, default: 300, min: 0 },
      rewardExpiryDays: { type: Number, default: 30, min: 1 },
      // Lifetime-spend thresholds for membership tiers (₹). Bronze is the default.
      tierSilver: { type: Number, default: 5000, min: 0 },
      tierGold: { type: Number, default: 20000, min: 0 },
      tierPlatinum: { type: Number, default: 50000, min: 0 },
    },

    invoice: {
      prefix: { type: String, default: 'INV' },
      nextNumber: { type: Number, default: 1, min: 1 },
    },

    billing: {
      serviceChargeRate: { type: Number, default: 0, min: 0, max: 100 }, // percent
      roundBill: { type: Boolean, default: true },
    },

    general: {
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
    },

    // QR / customer self-order payments. The UPI VPA + payee name are used to build
    // the `upi://pay` intent shown on the scan page for prepaid orders. The toggles
    // control which tender options the customer is offered; requireApprovalForQr
    // gates every QR order behind staff confirmation before it reaches the kitchen.
    payments: {
      upiVpa: { type: String, default: '', trim: true },
      upiName: { type: String, default: '', trim: true },
      acceptUpi: { type: Boolean, default: true },
      acceptCash: { type: Boolean, default: true },
      requireApprovalForQr: { type: Boolean, default: true },
    },

    // Customer CRM: the new-customer intro discount and the QR profile prompt.
    crm: {
      newCustomerDiscountEnabled: { type: Boolean, default: true },
      newCustomerDiscountPercent: { type: Number, default: 20, min: 0, max: 100 },
      newCustomerMaxDiscount: { type: Number, default: null, min: 0 }, // ₹ cap, null = uncapped
      newCustomerMinOrder: { type: Number, default: 0, min: 0 },
      askProfileOnScan: { type: Boolean, default: true },
      profileRequired: { type: Boolean, default: false }, // false = customer may Skip
    },
  },
  { timestamps: true }
);

// Exactly one document per scope: one global (both null), one per cafe (cafeId set,
// locationId null) and one per branch (locationId set). A COMPOUND unique index on
// { locationId, cafeId } enforces all three at once — a plain unique index on
// locationId alone would have collapsed every cafe doc (which all share
// locationId: null) into a single row. As before this is a plain (not partial)
// index so the null/null global row is itself deduplicated.
settingsSchema.index({ locationId: 1, cafeId: 1 }, { unique: true });

module.exports = mongoose.model('Settings', settingsSchema);
