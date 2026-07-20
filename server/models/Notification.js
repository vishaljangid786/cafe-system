const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
});

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      // 'activity' is the generic bucket for change-feed events that don't fit a
      // more specific domain type (reservations, bookings, menu, cash, etc.).
      enum: ['expense', 'user_action', 'table_action', 'order_action', 'activity', 'announcement', 'alert', 'message'],
      default: 'announcement',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // Optional: system-generated notifications (e.g. a customer QR self-order
      // awaiting approval) have no human sender. The client renders these as
      // "System" and hides the Reply action.
      required: false,
      default: null,
    },
    // Scoping for broadcast
    roleTarget: {
      type: String,
      enum: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef', 'all'],
    },
    locationTarget: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
    },
    recipients: [recipientSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes for fast retrieval
notificationSchema.index({ 'recipients.user': 1, 'recipients.isRead': 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
