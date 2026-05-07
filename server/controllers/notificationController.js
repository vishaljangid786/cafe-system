const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Location = require('../models/Location');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const { status, type, startDate, endDate, page = 1, limit = 20 } = req.query;

  const query = { 'recipients.user': req.user._id };

  if (status === 'unread') {
    query.recipients = { $elemMatch: { user: req.user._id, isRead: false } };
  } else if (status === 'read') {
    query.recipients = { $elemMatch: { user: req.user._id, isRead: true } };
  }

  if (type) query.type = type;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const notifications = await Notification.find(query)
    .populate('sender', 'name role profileImageUrl')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    'recipients.user': req.user._id,
    recipients: { $elemMatch: { user: req.user._id, isRead: false } }
  });

  if (notifications.length === 0 && page > 1) {
    // If user requested a page that doesn't exist, we could handle it here
    // but usually it's better to just return empty array
  }

  res.json({
    success: true,
    data: notifications || [],
    pagination: {
      total: total || 0,
      page: parseInt(page),
      pages: Math.ceil((total || 0) / limit),
      unreadCount: unreadCount || 0
    }
  });
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { 
      _id: req.params.id, 
      'recipients.user': req.user._id 
    },
    { 
      $set: { 'recipients.$.isRead': true } 
    },
    { new: true }
  );

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  res.json({ success: true });
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { 'recipients.user': req.user._id, 'recipients.isRead': false },
    { $set: { 'recipients.$[elem].isRead': true } },
    { arrayFilters: [{ 'elem.user': req.user._id, 'elem.isRead': false }] }
  );

  res.json({ success: true });
});

// @desc    Create and send a notification
// @route   POST /api/notifications
// @access  Private
const createNotification = asyncHandler(async (req, res) => {
  const { title, message, type, priority, targetType, targetId } = req.body;

  if (!title || !message || !targetType) {
    res.status(400);
    throw new Error('Title, message, and target type are required');
  }

  const senderRole = req.user.role;
  const senderBranch = req.user.assignedLocation;
  let recipients = [];

  // HIERARCHY VALIDATION & RECIPIENT RESOLUTION
  if (targetType === 'individual') {
    const targetUser = await User.findById(targetId);
    if (!targetUser) throw new Error('Target user not found');

    // Validation
    const canSend = validateHierarchy(req.user, targetUser);
    if (!canSend) {
      res.status(403);
      throw new Error('Communication hierarchy violation: You cannot send notifications to this user');
    }
    recipients = [{ user: targetUser._id }];
  } 
  else if (targetType === 'role') {
    if (senderRole !== 'super_admin' && targetId !== 'super_admin') {
       // Only super admin can broadcast to roles, except others can message super admin role? 
       // User said: Admin -> Super Admin. Branch Admin -> Their Admin.
       // Let's simplify: only super admin can do bulk role broadcast.
       res.status(403);
       throw new Error('Only Super Admins can broadcast to entire roles');
    }
    const users = await User.find({ role: targetId });
    recipients = users.map(u => ({ user: u._id }));
  } 
  else if (targetType === 'branch') {
    if (senderRole !== 'super_admin' && senderBranch?.toString() !== targetId) {
      res.status(403);
      throw new Error('You can only broadcast to your own branch');
    }
    const users = await User.find({ assignedLocation: targetId });
    recipients = users.map(u => ({ user: u._id }));
  }
  else if (targetType === 'system') {
    if (senderRole !== 'super_admin') {
      res.status(403);
      throw new Error('Only Super Admins can broadcast to the entire system');
    }
    const users = await User.find({});
    recipients = users.map(u => ({ user: u._id }));
  }

  if (recipients.length === 0) {
    res.status(400);
    throw new Error('No valid recipients found for this target');
  }

  // Duplicate Prevention Check (60 seconds)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const duplicate = await Notification.findOne({
    title,
    message,
    sender: req.user._id,
    createdAt: { $gte: oneMinuteAgo }
  });

  if (duplicate) {
    res.status(409);
    throw new Error('Duplicate notification detected. Please wait before resending.');
  }

  const notification = await Notification.create({
    title,
    message,
    type: type || 'announcement',
    priority: priority || 'medium',
    sender: req.user._id,
    recipients
  });

  // REAL-TIME EMISSION
  const io = getIO();
  recipients.forEach(r => {
    io.to(r.user.toString()).emit('new_notification', {
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      createdAt: notification.createdAt,
      sender: {
        name: req.user.name,
        role: req.user.role,
        profileImageUrl: req.user.profileImageUrl
      }
    });
  });

  res.status(201).json({
    success: true,
    data: notification
  });
});

// Helper for Hierarchy Validation
function validateHierarchy(sender, receiver) {
  const sRole = sender.role;
  const rRole = receiver.role;
  const sBranch = sender.assignedLocation?.toString();

  if (sRole === 'super_admin') return true;

  // Any lower role can notify higher role
  const roleOrder = ['staff', 'chef', 'branch_admin', 'location_admin', 'admin', 'super_admin'];
  const sIndex = roleOrder.indexOf(sRole);
  const rIndex = roleOrder.indexOf(rRole);

  if (rIndex > sIndex) {
    if (rRole === 'super_admin') return true;
    if (rRole === 'admin') {
      if (!sBranch) return true;
      return receiver.accessibleLocations?.some(loc => loc.toString() === sBranch);
    }
    if (rRole === 'branch_admin' || rRole === 'location_admin') {
      return receiver.assignedLocation?.toString() === sBranch;
    }
    return false;
  }

  // Same level or higher to lower
  if (sRole === 'admin' && sBranch === receiver.assignedLocation?.toString()) return true;
  if (sRole === 'branch_admin' && sBranch === receiver.assignedLocation?.toString()) return true;

  return false;
}

// @desc    Get allowable notification targets based on hierarchy
// @route   GET /api/notifications/targets
// @access  Private
const getTargetOptions = asyncHandler(async (req, res) => {
  const user = req.user;
  const role = user.role;
  const branchId = user.assignedLocation;

  let users = [];
  let roles = [];
  let branches = [];

  if (role === 'super_admin') {
    users = await User.find({ _id: { $ne: user._id } }).select('name role assignedLocation');
    roles = ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef', 'all'];
    branches = await Location.find().select('name city');
  } 
  else if (role === 'admin') {
    const supers = await User.find({ role: 'super_admin' }).select('name role');
    const accessibleBranches = user.accessibleLocations || [];
    const branchUsers = await User.find({ 
      assignedLocation: { $in: accessibleBranches }, 
      _id: { $ne: user._id } 
    }).select('name role');
    users = [...supers, ...branchUsers];
    
    branches = await Location.find({ _id: { $in: accessibleBranches } }).select('name');
  }
  else if (role === 'branch_admin') {
    const admins = await User.find({ role: 'admin', accessibleLocations: branchId }).select('name role');
    const staff = await User.find({ 
      assignedLocation: branchId, 
      role: { $in: ['staff', 'chef', 'location_admin'] } 
    }).select('name role');
    const supers = await User.find({ role: 'super_admin' }).select('name role');
    
    users = [...supers, ...admins, ...staff];
  }
  else if (role === 'staff' || role === 'chef') {
    const branchAdmins = await User.find({ role: 'branch_admin', assignedLocation: branchId }).select('name role');
    const admins = await User.find({ role: 'admin', accessibleLocations: branchId }).select('name role');
    const supers = await User.find({ role: 'super_admin' }).select('name role');
    
    users = [...supers, ...admins, ...branchAdmins];
  }

  res.json({
    success: true,
    data: {
      users,
      roles: role === 'super_admin' ? roles : [],
      branches: role === 'super_admin' ? branches : []
    }
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  getTargetOptions
};
