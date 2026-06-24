const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema(
  {
    ingredient: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', default: null },
    name: { type: String, required: true },   // snapshot (supports free-text goods too)
    unit: { type: String, default: 'unit' },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// A purchase order to a supplier. On RECEIVE it adds stock to the branch inventory
// and records a single purchase Expense (synced to the ledger) so COGS is captured.
const purchaseOrderSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    items: { type: [poItemSchema], default: [] },
    totalAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['ordered', 'received', 'cancelled'], default: 'ordered', index: true },
    notes: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receivedAt: { type: Date },
    expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }, // ledger link
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ locationId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
