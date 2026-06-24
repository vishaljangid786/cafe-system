const mongoose = require('mongoose');

// Post-visit customer feedback. Submitted via a public QR/link (no login) or
// collected by staff. Aggregated per branch for ratings/insights.
const feedbackSchema = new mongoose.Schema(
  {
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    foodRating: { type: Number, min: 1, max: 5 },
    serviceRating: { type: Number, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 1000 },
    source: { type: String, enum: ['qr', 'web', 'staff'], default: 'web' },
  },
  { timestamps: true }
);

feedbackSchema.index({ locationId: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
