const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
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
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String, // HH:mm format
      required: true,
    },
    endTime: {
      type: String, // HH:mm format
      required: true,
    },
    numberOfGuests: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    specialRequests: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

// Indexes for querying availability
bookingSchema.index({ locationId: 1, date: 1, status: 1 });
bookingSchema.index({ userId: 1, date: -1 });

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
