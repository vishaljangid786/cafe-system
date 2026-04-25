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
      enum: ['expense', 'user_action', 'table_action', 'announcement', 'alert', 'message'],
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
      required: true,
    },
    // Scoping for broadcast
    roleTarget: {
      type: String,
      enum: ['super_admin', 'admin', 'branch_admin', 'staff', 'chef', 'all'],
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
