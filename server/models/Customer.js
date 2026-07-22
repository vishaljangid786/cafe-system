const mongoose = require('mongoose');

// Per-cafe membership. One human (one Customer document, keyed by phone) can be a
// customer of several cafes; each cafe tracks its own new/existing status, its own
// spend/points, and its own one-shot new-customer discount.
const membershipSchema = new mongoose.Schema(
  {
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      required: true,
      index: true,
    },
    // 'new' until the FIRST completed order at this cafe, then 'existing'.
    // Only orderService._handleCustomerCRM may write this.
    status: {
      type: String,
      enum: ['new', 'existing'],
      default: 'new',
    },
    // Every branch of this cafe the customer has touched.
    branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
    firstBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' }, // acquisition branch
    joinedAt: { type: Date, default: Date.now },
    firstOrderAt: { type: Date, default: null },
    lastVisit: { type: Date, default: null },
    orderCount: { type: Number, default: 0, min: 0 },
    totalSpend: { type: Number, default: 0, min: 0 },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    // One-shot per cafe. Claimed atomically at order completion.
    newCustomerDiscountUsed: { type: Boolean, default: false },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    // ── Identity (global — exactly one document per human) ──────────────────
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: 'Valued Customer',
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say', null],
      default: null,
    },
    // OPTIONAL at capture, IMMUTABLE once set (enforced in the hooks below).
    dob: { type: Date, default: null },
    dobLockedAt: { type: Date, default: null },
    // Derived from dob so "whose birthday is today" is an index hit, not an $expr scan.
    dobMonth: { type: Number, default: null, min: 1, max: 12 },
    dobDay: { type: Number, default: null, min: 1, max: 31 },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },

    // ── Per-cafe membership ────────────────────────────────────────────────
    memberships: [membershipSchema],

    // ── Roll-ups across every cafe (the existing /top, /inactive, /analytics
    // endpoints sort and aggregate on these — keep them maintained) ─────────
    visits: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSpend: {
      type: Number,
      default: 0,
      min: 0,
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastVisit: {
      type: Date,
      default: Date.now,
    },
    favoriteItems: {
      type: Map,
      of: Number, // Tracking menu item ObjectIds as strings -> frequency count
      default: {},
    },
    // Initial acquisition branch. Retained because existing code reads it; the
    // per-cafe acquisition branch now also lives on memberships[].firstBranch.
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },

    // ── Provenance ─────────────────────────────────────────────────────────
    source: {
      type: String,
      enum: ['qr', 'pos', 'import'],
      default: 'pos',
    },
    profileCompletedAt: { type: Date, default: null }, // set when the QR form is submitted
    skippedAt: { type: Date, default: null },          // last time the QR popup was dismissed

    // ── Marketing consent ──────────────────────────────────────────────────
    // WhatsApp policy requires honouring opt-outs. Set true when a customer
    // replies STOP/UNSUBSCRIBE (handled on the webhook); broadcasts and
    // automations skip anyone opted out.
    marketingOptOut: { type: Boolean, default: false },
    marketingOptOutAt: { type: Date, default: null },
    lastMarketedAt: { type: Date, default: null }, // last time we sent them a campaign
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// Global identity: one phone = one human, across every cafe. This replaces the
// old { phone, branch } partial-unique index, which split one person into N rows.
customerSchema.index({ phone: 1 }, { unique: true });
customerSchema.index({ 'memberships.cafe': 1, 'memberships.status': 1 });
customerSchema.index({ 'memberships.branches': 1 });
customerSchema.index({ dobMonth: 1, dobDay: 1 });
customerSchema.index({ totalSpend: -1 });
customerSchema.index({ lastVisit: -1 });

// ── DOB derivation + immutability ────────────────────────────────────────────
// A birthday drives recurring offers, so it is write-once: allowing edits would let
// someone farm a fresh birthday coupon every month. Enforced at the MODEL layer so
// every write path (controllers, scripts, imports) is covered, not just the API.
const DOB_LOCKED_ERROR = 'Date of birth cannot be changed once set';

const applyDobParts = (target, dob) => {
  if (dob === null || dob === undefined) return;
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) return;
  target.dobMonth = d.getMonth() + 1;
  target.dobDay = d.getDate();
};

// Snapshot the as-loaded dob/lock so pre('save') can tell a genuine CHANGE from a
// harmless re-save of the same value.
customerSchema.post('init', function snapshotDob(doc) {
  doc.$locals.originalDob = doc.dob ? new Date(doc.dob).getTime() : null;
  doc.$locals.originalDobLockedAt = doc.dobLockedAt || null;
});

customerSchema.pre("save", async function preSaveDob() {
  if (!this.isModified('dob')) return;
  // Reject only a real change to an already-locked dob. A brand-new document can
  // never be "already locked", so first capture always succeeds.
  if (!this.isNew && this.$locals.originalDobLockedAt) {
    const incoming = this.dob ? new Date(this.dob).getTime() : null;
    if (incoming !== this.$locals.originalDob) {
      throw new Error(DOB_LOCKED_ERROR);
    }
  }
  if (this.dob) {
    applyDobParts(this, this.dob);
    if (!this.dobLockedAt) this.dobLockedAt = new Date();
  } else {
    this.dobMonth = null;
    this.dobDay = null;
  }
});

customerSchema.pre(['findOneAndUpdate', 'updateOne'], async function preUpdateDob() {
  const update = this.getUpdate() || {};
  const $set = update.$set || {};
  const $setOnInsert = update.$setOnInsert || {};
  const hasSetDob = Object.prototype.hasOwnProperty.call($set, 'dob')
    || Object.prototype.hasOwnProperty.call(update, 'dob');
  const hasInsertDob = Object.prototype.hasOwnProperty.call($setOnInsert, 'dob');

  if (!hasSetDob && !hasInsertDob) return;

  const incomingDob = hasSetDob
    ? ($set.dob !== undefined ? $set.dob : update.dob)
    : $setOnInsert.dob;

  if (hasSetDob) {
    // $set on an existing, already-locked document is a change attempt.
    const existing = await this.model
      .findOne(this.getQuery())
      .select('dob dobLockedAt')
      .lean();
    if (existing && existing.dobLockedAt) {
      const same = existing.dob && incomingDob
        && new Date(existing.dob).getTime() === new Date(incomingDob).getTime();
      if (!same) throw new Error(DOB_LOCKED_ERROR);
    }
    if (incomingDob) {
      update.$set = update.$set || {};
      applyDobParts(update.$set, incomingDob);
      if (!existing || !existing.dobLockedAt) update.$set.dobLockedAt = new Date();
    }
  }

  if (hasInsertDob && incomingDob) {
    update.$setOnInsert = update.$setOnInsert || {};
    applyDobParts(update.$setOnInsert, incomingDob);
    if (!update.$setOnInsert.dobLockedAt) update.$setOnInsert.dobLockedAt = new Date();
  }

  this.setUpdate(update);
});

customerSchema.statics.DOB_LOCKED_ERROR = DOB_LOCKED_ERROR;

module.exports = mongoose.model('Customer', customerSchema);
