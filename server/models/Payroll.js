const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: String, // YYYY-MM
      required: true,
    },
    dailyRate: {
      type: Number,
      required: true,
    },
    payableDays: {
      type: Number,
      required: true,
    },
    baseSalary: {
      type: Number,
      required: true,
    },
    penalties: {
      lateMark: { type: Number, default: 0 },
      absent: { type: Number, default: 0 },
      leave: { type: Number, default: 0 },
    },
    bonuses: {
      topSeller: { type: Number, default: 0 },
      performance: { type: Number, default: 0 },
      extraShifts: { type: Number, default: 0 },
    },
    netSalary: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING_BRANCH_APPROVAL', 'PENDING_ADMIN_APPROVAL', 'FINAL_APPROVED', 'PAID'],
      default: 'PENDING_BRANCH_APPROVAL',
    },
    approvedByBranchAt: { type: Date },
    approvedByAdminAt: { type: Date },
    approvedBySuperAdminAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
payrollSchema.index({ user: 1, month: 1 }, { unique: true });
payrollSchema.index({ status: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);
