const mongoose = require('mongoose');

// A vendor that supplies ingredients/goods. locationId null = shared across the org.
const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Supplier name is required'], trim: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    gstin: { type: String, default: '' },
    paymentTerms: { type: String, default: '' }, // e.g. "Net 15", "On delivery"
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null, index: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Supplier', supplierSchema);
