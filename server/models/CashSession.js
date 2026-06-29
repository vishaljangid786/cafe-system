const mongoose = require('mongoose');

// A cash-drawer / register shift. A cashier OPENS the drawer with a starting
// float, records cash pay-ins/pay-outs during the shift, then CLOSES it with a
// physical count. The close computes expected cash (float + cash sales + pay-ins
// - pay-outs - cash refunds) and the variance vs the counted amount (the Z-report).
const movementSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['in', 'out'], required: true }, // pay-in / pay-out
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cashSessionSchema = new mongoose.Schema(
  {
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },

    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    openedAt: { type: Date, default: Date.now },
    openingFloat: { type: Number, default: 0, min: 0 },

    movements: { type: [movementSchema], default: [] },

    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },
    countedCash: { type: Number, min: 0 },   // physical count at close
    cashSales: { type: Number, default: 0 }, // cash orders during the shift
    cashRefunds: { type: Number, default: 0 },
    cashExpenses: { type: Number, default: 0 }, // cash-paid expenses during the shift
    expectedCash: { type: Number },          // float + sales + in - out - refunds - expenses
    variance: { type: Number },              // countedCash - expectedCash (- = short)
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// At most one OPEN drawer per branch at a time.
cashSessionSchema.index(
  { locationId: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } }
);

module.exports = mongoose.model('CashSession', cashSessionSchema);
