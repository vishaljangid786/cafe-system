const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Branch this payroll belongs to, captured at generation. Used for the approver's
    // access check and to attribute the salary Expense to the correct branch ledger,
    // even if the employee is later transferred. Legacy records (pre-this-field) fall
    // back to the employee's current assignedLocation at approval time.
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
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
    // Manual line-items applied by an admin/branch-admin before approval — a
    // deduction (e.g. damaged equipment) or a bonus (e.g. overtime / good work).
    // These feed directly into netSalary (see recomputeNetSalary in the controller).
    adjustments: [
      {
        type: { type: String, enum: ['deduction', 'bonus'], required: true },
        amount: { type: Number, required: true, min: 0 },
        reason: { type: String, required: true, trim: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        byName: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
    netSalary: {
      type: Number,
      required: true,
    },
    // PENDING_APPROVAL → (anyone with salaries.approve) → PAID, which posts the
    // salary to the ledger as an Expense. REJECTED records can be regenerated.
    // The legacy multi-stage values are kept in the enum so historical records
    // still validate.
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'PAID', 'REJECTED', 'PENDING_BRANCH_APPROVAL', 'PENDING_ADMIN_APPROVAL', 'FINAL_APPROVED'],
      default: 'PENDING_APPROVAL',
    },
    rejectedReason: { type: String },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    approvedByBranchAt: { type: Date },
    approvedByAdminAt: { type: Date },
    approvedBySuperAdminAt: { type: Date },
    // Link to the Expense posted to the ledger when this payroll was PAID.
    // Presence also guards against double-posting the salary cost.
    ledgerExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
payrollSchema.index({ user: 1, month: 1 }, { unique: true });
payrollSchema.index({ status: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);
