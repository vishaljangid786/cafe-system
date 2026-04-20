const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIO } = require('../config/socket');

/**
 * Sends a notification hierarchically
 * @param {Object} params
 * @param {String} params.title Notification title
 * @param {String} params.message Notification message
 * @param {String} params.type 'expense' | 'user_action' | 'table_action'
 * @param {Object} params.performedByUser The User document of the person who triggered this
 * @param {String} [params.locationId] Location ID context if applicable
 */
const sendNotification = async ({ title, message, type, performedByUser, locationId }) => {
  try {
    const roleTarget = [];

    // Determine target roles hierarchically
    if (performedByUser.role === 'staff') {
      roleTarget.push('location_admin', 'admin', 'super_admin');
    } else if (performedByUser.role === 'location_admin') {
      roleTarget.push('admin', 'super_admin');
    } else if (performedByUser.role === 'admin') {
      roleTarget.push('super_admin');
    } else {
      // Super admin performed action, no higher role exists (maybe notify other super admins?)
      return; 
    }

    // Build query to find eligible recipients
    const query = { role: { $in: roleTarget }, _id: { $ne: performedByUser._id } };

    const users = await User.find(query);

    // Filter by location if necessary (location_admins only care about their location)
    const recipientsList = [];
    const targetLocationId = locationId || performedByUser.assignedLocation;

    users.forEach((u) => {
      if (u.role === 'location_admin') {
        if (u.assignedLocation?.toString() === targetLocationId?.toString()) {
          recipientsList.push({ user: u._id, isRead: false });
        }
      } else {
        // admin and super_admin get everything
        recipientsList.push({ user: u._id, isRead: false });
      }
    });

    if (recipientsList.length === 0) return;

    // Create DB Record
    const notification = await Notification.create({
      title,
      message,
      type,
      createdBy: performedByUser._id,
      roleTarget,
      recipients: recipientsList,
    });

    // Populate createdBy for the real-time payload
    await notification.populate('createdBy', 'name email role');

    // Emit via Socket.io
    const io = getIO();
    recipientsList.forEach((recipient) => {
      io.to(recipient.user.toString()).emit('new_notification', notification);
    });

  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

module.exports = sendNotification;
