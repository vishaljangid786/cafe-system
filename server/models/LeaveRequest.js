const mongoose = require('mongoose');

// A staff/chef leave request. On approval it stamps the relevant Attendance days
// (paid types -> 'leave' which counts toward salary; unpaid -> 'absent').
const leaveRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },

    fromDate: { type: String, required: true }, // YYYY-MM-DD
    toDate: { type: String, required: true },    // YYYY-MM-DD
    // paid/sick/casual count toward salary (Attendance 'leave'); unpaid does not.
    type: { type: String, enum: ['paid', 'unpaid', 'sick', 'casual'], default: 'paid' },
    reason: { type: String, default: '' },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: '' },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ locationId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
