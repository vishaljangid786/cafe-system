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
      enum: ['present', 'absent', 'half-day'],
      required: [true, 'Status is required'],
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
