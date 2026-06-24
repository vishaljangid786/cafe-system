const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Location ID is required'],
    },
    date: {
      type: String, // Stored as YYYY-MM-DD
      required: [true, 'Date is required'],
    },
    status: {
      type: String,
      // present/half-day = worked; week-off & leave = PAID non-working days (count
      // toward salary); absent = unpaid.
      enum: ['present', 'absent', 'half-day', 'week-off', 'leave'],
      required: [true, 'Status is required'],
    },
    // Clock-in/out tracking (self-service). Enables late detection, worked hours,
    // and downstream overtime/late-penalty payroll rules.
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    workedMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one attendance per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
// Indexes for efficient querying and aggregation
attendanceSchema.index({ locationId: 1, date: 1 });
attendanceSchema.index({ user: 1, locationId: 1, date: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;
