const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    index: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  role: String,
  details: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed,
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: false,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

auditLogSchema.index({ action: 1, timestamp: -1 });
// Hot path: super-admin "activity by user" lookups
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ locationId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
