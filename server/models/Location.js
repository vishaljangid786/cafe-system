const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    // The cafe (brand/organization) this branch belongs to. Every branch is owned
    // by exactly one cafe. Optional at the schema level only so the migration can
    // backfill existing branches; all newly created branches set it.
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      index: true,
    },
    name: {
      type: String,
      // name is now optional as per requirement
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      default: 'India'
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required']
    },
    geoCoordinates: {
      lat: { type: Number },
      lng: { type: Number }
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'hold', 'deleted'],
      default: 'active',
    },
    holdReason: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPermanentlyDeleted: {
      type: Boolean,
      default: false,
    },
    maxCapacity: {
      type: Number,
      default: 20,
    },
    dietaryType: {
      type: String,
      enum: ['veg', 'non-veg', 'both'],
      default: 'both',
    },
  },
  {
    timestamps: true,
  }
);

locationSchema.index({ status: 1 });
locationSchema.index({ cafe: 1 });
// A branch name is unique WITHIN a cafe (per city), so two different cafes may each
// have e.g. a "Mumbai - Downtown" branch. Legacy branches with no cafe yet still
// fall under a single (null) bucket until the migration backfills `cafe`.
locationSchema.index({ cafe: 1, city: 1, name: 1 }, { unique: true });

const Location = mongoose.model('Location', locationSchema);
module.exports = Location;
