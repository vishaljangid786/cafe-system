const mongoose = require('mongoose');

// A Cafe is a brand / organization that OWNS one or more branches (Locations).
//
// Hierarchy:  super_admin  ─owns→  Cafe  ─owns→  Location (branch)  ─has→  staff/chef
//
// - super_admin: platform-level, sees & creates every cafe.
// - admin:       belongs to one or more cafes (User.cafes) and can only create /
//                manage branches inside those cafes.
// - branch_admin/location_admin/staff/chef: scoped to a branch, and therefore to
//                that branch's cafe (derived via Location.cafe).
//
// Receipts pull their full branding (name, logo, GSTIN, address, contact) from the
// cafe that owns the order's branch.
const cafeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Cafe name is required'],
      trim: true,
    },
    // URL-safe identifier derived from the name; handy for public links and lookups.
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    logo: {
      type: String,
      default: '',
    },
    gstin: {
      type: String,
      trim: true,
    },
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: 'India' },
      pincode: { type: String, default: '' },
    },
    contact: {
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'deleted'],
      default: 'active',
      index: true,
    },
    // The super_admin who created the cafe.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Cafe names must be unique among non-deleted cafes. A partial unique index lets a
// soft-deleted cafe's name be reused. NOTE: MongoDB partial indexes do NOT support
// $ne, so we enumerate the live statuses with $in (a $ne filter silently fails to
// build the index, dropping the uniqueness guarantee entirely).
cafeSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['active', 'inactive'] } } }
);

const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Synchronous pre-hook (no `next`): Mongoose 9 calls zero-arity hooks and
// proceeds when they return. The old `function (next) { … next() }` style threw
// "next is not a function" under Mongoose 9, which crashed every Cafe.create().
cafeSchema.pre('validate', function () {
  if (this.name && (!this.slug || this.isModified('name'))) {
    this.slug = slugify(this.name);
  }
});

const Cafe = mongoose.model('Cafe', cafeSchema);
module.exports = Cafe;
