const mongoose = require('mongoose');

// A "Permission Preset" is a reusable, named bundle of permissions (a custom
// "role" in the UI). It does NOT change a user's actual role — it is applied to
// a user to set their `permissions`. Presets can only contain permissions the
// creator themselves holds (enforced in the controller).
const permissionPresetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
    },
    permissions: {
      viewRevenue: { type: Boolean, default: false },
      editRevenue: { type: Boolean, default: false },
      viewOrders: { type: Boolean, default: false },
      manageOrders: { type: Boolean, default: false },
      forceComplete: { type: Boolean, default: false },
      exportReports: { type: Boolean, default: false },
      manageStaff: { type: Boolean, default: false },
      manageNotifications: { type: Boolean, default: false },
      viewAnalytics: { type: Boolean, default: false },
      manageCoupons: { type: Boolean, default: false },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdByName: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PermissionPreset', permissionPresetSchema);
