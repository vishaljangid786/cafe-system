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
    // Determine target roles hierarchically
    let roleTarget = [];
    if (['staff', 'chef'].includes(performedByUser.role)) {
      roleTarget = ['branch_admin', 'admin', 'super_admin'];
    } else if (performedByUser.role === 'branch_admin') {
      roleTarget = ['admin', 'super_admin'];
    } else if (performedByUser.role === 'admin') {
      roleTarget = ['super_admin'];
    } else {
      return; 
    }

    const targetLocationId = locationId || performedByUser.assignedLocation;

    // Filter by role and branch — admins only receive events for their accessible branches
    const query = {
      _id: { $ne: performedByUser._id },
      $or: [
        ...(roleTarget.includes('super_admin') ? [{ role: 'super_admin' }] : []),
        ...(roleTarget.includes('admin') && targetLocationId ? [{ role: 'admin', accessibleLocations: targetLocationId }] : []),
        ...(roleTarget.includes('branch_admin') ? [{ role: 'branch_admin', assignedLocation: targetLocationId }] : [])
      ]
    };

    // Only fetch IDs and roles to minimize memory footprint
    const users = await User.find(query).select('_id role');
    
    if (users.length === 0) return;

    const recipientsList = users.map(u => ({ user: u._id, isRead: false }));

    const notification = await Notification.create({
      title,
      message,
      type,
      sender: performedByUser._id,
      recipients: recipientsList,
    });

    // Populate sender for the real-time payload
    await notification.populate('sender', 'name email role');

    // Emit via Socket.io efficiently using pre-defined rooms
    const io = getIO();
    
    // 1. Emit to Global Admins and Super Admins
    roleTarget.forEach(role => {
      if (role !== 'branch_admin') {
        io.to(`role_${role}`).emit('new_notification', notification);
      }
    });

    // 2. Emit to Branch Admins of specific location
    if (roleTarget.includes('branch_admin') && targetLocationId) {
      io.to(`branch_${targetLocationId}_branch_admin`).emit('new_notification', notification);
    }

  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

module.exports = sendNotification;
