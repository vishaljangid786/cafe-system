const mongoose = require('mongoose');

// A walk-in waitlist entry for when the floor is full. Staff add a party, then
// seat / cancel / mark no-show as tables free up.
const waitlistSchema = new mongoose.Schema(
  {
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, default: '' },
    partySize: { type: Number, default: 1, min: 1 },
    quotedWaitMinutes: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },

    status: { type: String, enum: ['waiting', 'seated', 'cancelled', 'no-show'], default: 'waiting', index: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
    seatedAt: { type: Date },
  },
  { timestamps: true }
);

waitlistSchema.index({ locationId: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);
