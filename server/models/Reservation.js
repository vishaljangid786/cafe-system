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
    },
    advancePayment: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
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

const Reservation = mongoose.model('Reservation', reservationSchema);
module.exports = Reservation;
