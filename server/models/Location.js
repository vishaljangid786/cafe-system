const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: true,
  }
);

locationSchema.index({ status: 1 });
locationSchema.index({ city: 1, name: 1 }, { unique: true });

const Location = mongoose.model('Location', locationSchema);
module.exports = Location;
