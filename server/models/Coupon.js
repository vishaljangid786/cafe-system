const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    maxDiscount: {
      type: Number,
      default: null,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    usageLimit: {
      type: Number,
      default: null, // null means unlimited
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    appliesTo: {
      items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
      categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Scoping (additive; null/empty preserves the legacy org-wide behaviour) ──
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      default: null, // null = valid at every cafe
    },
    branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }], // empty = all branches of `cafe`

    // ── Audience targeting ─────────────────────────────────────────────────
    // 'public'   — anyone may redeem (legacy behaviour)
    // 'birthday' — generated for a birthday batch, redeemable only by its owner
    // 'targeted' — manually assigned to specific customers
    audience: {
      type: String,
      enum: ['public', 'birthday', 'targeted'],
      default: 'public',
    },
    assignedCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],

    // Provenance for generated batches, so a whole campaign can be listed/deactivated.
    campaign: {
      batchId: { type: String, default: null, index: true },
      kind: { type: String, enum: ['birthday', 'manual'], default: 'manual' },
      generatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

couponSchema.index({ isActive: 1 });
couponSchema.index({ cafe: 1, isActive: 1 });
couponSchema.index({ audience: 1, 'campaign.batchId': 1 });

module.exports = mongoose.model('Coupon', couponSchema);
