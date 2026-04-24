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
      enum: ['expense', 'user_action', 'table_action'],
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    roleTarget: [
      {
        type: String,
        enum: ['super_admin', 'admin', 'branch_admin', 'staff'],
      },
    ],
    // Optional scoping to a location
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
    },
    recipients: [recipientSchema],
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
