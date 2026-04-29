const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: 'Valued Customer'
    },
    visits: {
      type: Number,
      default: 0,
    },
    totalSpend: {
      type: Number,
      default: 0,
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
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
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: false, // Initial acquisition branch
    }
  },
  { timestamps: true }
);

// Indexes
customerSchema.index({ totalSpend: -1 });
customerSchema.index({ lastVisit: -1 });

module.exports = mongoose.model('Customer', customerSchema);
