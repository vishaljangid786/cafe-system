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
  },
  { timestamps: true }
);

// One settings doc per branch AND exactly one global doc. A plain unique index on
// locationId enforces both: at most one document may have locationId = null (the
// global default), and at most one per branch ObjectId. (A partial index excluding
// null would have allowed duplicate global docs — see review.)
settingsSchema.index({ locationId: 1 }, { unique: true });

module.exports = mongoose.model('Settings', settingsSchema);
