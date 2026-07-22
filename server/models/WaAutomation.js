const mongoose = require('mongoose');

// A single automated-message rule. One rule per (trigger, scope) — the scope is a
// cafe, a branch, or global (both null). When the trigger fires the engine sends
// the mapped template to the matching customer(s).
//
// Triggers:
//   welcome   — event: a customer completes their profile for the first time
//   birthday  — scheduled: runs daily, matches customers whose birthday is today
//   winback   — scheduled: runs daily, matches customers inactive >= inactiveDays
//   thankyou  — event: a customer's order is completed
const waAutomationSchema = new mongoose.Schema(
  {
    trigger: {
      type: String,
      enum: ['welcome', 'birthday', 'winback', 'thankyou'],
      required: true,
    },
    enabled: { type: Boolean, default: false },
    template: { type: String, default: '' },
    language: { type: String, default: 'en' },
    // Scope: both null = global (applies to every cafe the runner covers).
    cafe: { type: mongoose.Schema.Types.ObjectId, ref: 'Cafe', default: null },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    // winback tuning
    inactiveDays: { type: Number, default: 30, min: 7, max: 365 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastRunAt: { type: Date, default: null },
    lastRunCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One rule per trigger per scope.
waAutomationSchema.index({ trigger: 1, cafe: 1, location: 1 }, { unique: true });

module.exports = mongoose.model('WaAutomation', waAutomationSchema);
