const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
    },
    reservationType: {
      type: String,
      enum: ['table', 'full-location'],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    tableIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table',
      },
    ],
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    startTime: {
      type: String, // HH:mm
      required: true,
    },
    endTime: {
      type: String, // HH:mm
      required: true,
    },
    isFullDay: {
      type: Boolean,
      default: false,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerPhone: {
      type: String,
      required: [true, 'Customer phone is required'],
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Total amount cannot be negative'],
    },
    advancePayment: {
      type: Number,
      default: 0,
      min: [0, 'Advance payment cannot be negative'],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
    },
    status: {
      type: String,
      // 'no-show' = the party never arrived: the slot is freed and the advance is
      // forfeited (kept as income — never reconciled against an order).
      enum: ['pending', 'confirmed', 'cancelled', 'no-show'],
      default: 'pending',
    },
    // Link to the advance-income Expense (so the advance can be reconciled against
    // the final bill), and a flag so it's only reconciled once.
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      default: null,
    },
    advanceApplied: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster querying and availability checks
reservationSchema.index({ locationId: 1, date: 1, status: 1 });
reservationSchema.index({ reservationType: 1 });
reservationSchema.index({ customerPhone: 1 });
reservationSchema.index({ userId: 1 });
reservationSchema.index({ date: -1 });

const Reservation = mongoose.model('Reservation', reservationSchema);
module.exports = Reservation;
