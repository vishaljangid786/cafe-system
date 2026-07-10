const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Location = require('../models/Location');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const { canAccessLocation, userLocationIds, clampLimit } = require('../utils/accessControl');

// Single source of truth for who each role may message.
//  - super_admin: anyone
//  - admin: the super admin + everyone in their branches (branch admin/staff/chef/location admin)
//  - branch_admin: their admin + their staff/chef/location admin (super admin only with permission)
//  - staff/chef/location_admin: their branch admin + their admin (super admin only with permission)
// getTargetOptions and validateHierarchy both derive from this so the dropdown and
// the server-side check can never drift apart.
const allowedTargetRoles = (user) => {
  const canSuper = user.permissions?.messageSuperAdmin === true;
  switch (user.role) {
    case 'super_admin':
      return ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'];
    case 'admin':
      return ['super_admin', 'branch_admin', 'location_admin', 'staff', 'chef'];
    case 'branch_admin':
      return [...(canSuper ? ['super_admin'] : []), 'admin', 'location_admin', 'staff', 'chef'];
    case 'location_admin':
    case 'staff':
    case 'chef':
      return [...(canSuper ? ['super_admin'] : []), 'admin', 'branch_admin'];
    default:
      return [];
  }
};

// Has this user been switched to receive-only (sendMessages explicitly false)?
// Undefined is treated as allowed so accounts created before this field existed
// keep working. super_admin always bypasses.
const canSendMessages = (user) =>
  user.role === 'super_admin' || user.permissions?.sendMessages !== false;

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

  // Free-text search across the notification title and message.
  if (req.query.search) {
    const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = { $regex: safe, $options: 'i' };
    query.$or = [{ title: rx }, { message: rx }];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const limitNum = clampLimit(limit, 20);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const skip = (pageNum - 1) * limitNum;

  const notifications = await Notification.find(query)
    .populate('sender', 'name role profileImageUrl')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    'recipients.user': req.user._id,
    recipients: { $elemMatch: { user: req.user._id, isRead: false } }
  });

  // Map notifications to include isRead status for the current user
  const processedNotifications = notifications.map(notif => {
    const recipient = notif.recipients.find(r => r.user.toString() === req.user._id.toString());
    return {
      ...notif,
      isRead: recipient ? recipient.isRead : false
    };
  });

  res.json({
    success: true,
    data: processedNotifications || [],
    pagination: {
      total: total || 0,
      page: pageNum,
      pages: Math.ceil((total || 0) / limitNum),
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

// @desc    Mark notification as unread
// @route   PATCH /api/notifications/:id/unread
// @access  Private
const markAsUnread = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { 
      _id: req.params.id, 
      'recipients.user': req.user._id 
    },
    { 
      $set: { 'recipients.$.isRead': false } 
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
  const { title, message, type, priority, targetType, targetId, replyTo } = req.body;

  if (!title || !message || !targetType) {
    res.status(400);
    throw new Error('Title, message, and target type are required');
  }

  const senderRole = req.user.role;

  // Receive-only accounts cannot send messages.
  if (!canSendMessages(req.user)) {
    res.status(403);
    throw new Error('You do not have permission to send messages');
  }

  // A role / whole-system broadcast stays limited to the super admin (or anyone
  // explicitly granted sendGlobalNotifications).
  const canBroadcast = senderRole === 'super_admin' || req.user.permissions?.sendGlobalNotifications === true;
  let recipients = [];

  // HIERARCHY VALIDATION & RECIPIENT RESOLUTION
  if (targetType === 'individual') {
    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      res.status(404);
      throw new Error('Target user not found');
    }

    // Normal rule: the target must be in the sender's allowed set. EXCEPTION:
    // you may always reply to someone who actually messaged you — even a superior
    // outside your default targets (e.g. staff replying to a super-admin). We
    // confirm the reply is genuine by checking replyTo points at a notification
    // that this target sent and that the current user received.
    let allowed = validateHierarchy(req.user, targetUser);
    if (!allowed && replyTo) {
      const original = await Notification.findOne({
        _id: replyTo,
        sender: targetUser._id,
        'recipients.user': req.user._id,
      }).select('_id');
      allowed = !!original;
    }
    if (!allowed) {
      res.status(403);
      throw new Error('You cannot send a message to this user');
    }
    recipients = [{ user: targetUser._id }];
  }
  else if (targetType === 'role') {
    if (!canBroadcast) {
      res.status(403);
      throw new Error('Only super admins can message a whole role');
    }
    // 'all' is the everyone-pseudo-role surfaced in the targets list — treat it as
    // a system broadcast rather than a (non-existent) role lookup.
    // Non-super broadcasters are confined to their own cafe/branches so a delegated
    // sendGlobalNotifications can't blast every tenant; super_admin stays platform-wide.
    const scope = senderRole === 'super_admin'
      ? {}
      : { $or: [{ assignedLocation: { $in: userLocationIds(req.user) } }, { accessibleLocations: { $in: userLocationIds(req.user) } }] };
    const baseFilter = targetId === 'all' ? {} : { role: targetId };
    const users = await User.find({ ...baseFilter, ...scope });
    recipients = users.map(u => ({ user: u._id }));
  }
  else if (targetType === 'branch') {
    // Branch broadcast is for the super admin and for admins over their own branches.
    const isAllowed = canBroadcast || (senderRole === 'admin' && canAccessLocation(req.user, targetId));
    if (!isAllowed) {
      res.status(403);
      throw new Error('You do not have access to message this branch');
    }
    const branchUsers = await User.find({
      $or: [
        { assignedLocation: targetId },
        { accessibleLocations: targetId }
      ]
    }).select('_id role');
    // A broadcast must never reach a role the sender isn't allowed to message.
    const allowedRoles = allowedTargetRoles(req.user);
    recipients = branchUsers
      .filter(u => canBroadcast || allowedRoles.includes(u.role))
      .map(u => ({ user: u._id }));
  }
  else if (targetType === 'system') {
    if (!canBroadcast) {
      res.status(403);
      throw new Error('Only super admins can message everyone');
    }
    // A delegated (non-super) broadcaster's "everyone" is everyone in THEIR cafe.
    const scope = senderRole === 'super_admin'
      ? {}
      : { $or: [{ assignedLocation: { $in: userLocationIds(req.user) } }, { accessibleLocations: { $in: userLocationIds(req.user) } }] };
    const users = await User.find(scope);
    recipients = users.map(u => ({ user: u._id }));
  }

  // Never notify yourself.
  recipients = recipients.filter(r => r.user.toString() !== req.user._id.toString());

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

// Helper for Hierarchy Validation. Derives from allowedTargetRoles so the rule is
// in one place: the receiver's role must be allowed AND they must share a branch
// with the sender (the super admin is reachable only via the messageSuperAdmin
// permission, which is already baked into allowedTargetRoles).
function validateHierarchy(sender, receiver) {
  if (sender.role === 'super_admin') return true;

  if (!allowedTargetRoles(sender).includes(receiver.role)) return false;

  // The super admin has no branch, so a branch match isn't required — being in the
  // allowed-roles set (permission granted) is enough.
  if (receiver.role === 'super_admin') return true;

  // Everyone else (up or down the chain) must share at least one branch with the
  // sender. canAccessLocation checks the receiver holds that branch.
  const senderBranches = userLocationIds(sender);
  return senderBranches.some(branchId => canAccessLocation(receiver, branchId));
}

// @desc    Get allowable notification targets based on hierarchy
// @route   GET /api/notifications/targets
// @access  Private
const getTargetOptions = asyncHandler(async (req, res) => {
  const user = req.user;
  const role = user.role;
  const branchIds = userLocationIds(user);
  const canSuper = user.permissions?.messageSuperAdmin === true;
  const canBroadcast = role === 'super_admin' || user.permissions?.sendGlobalNotifications === true;

  // Receive-only accounts have nobody to send to.
  if (!canSendMessages(user)) {
    return res.json({ success: true, data: { users: [], roles: [], branches: [] } });
  }

  let users = [];
  let roles = [];
  let branches = [];

  if (canBroadcast && role === 'super_admin') {
    users = await User.find({ _id: { $ne: user._id } }).select('name role assignedLocation');
    roles = ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef', 'all'];
    branches = await Location.find().select('name city');
  }
  else if (canBroadcast) {
    // Delegated (non-super) broadcaster: may broadcast, but ONLY within their own
    // cafe/branches — never the entire platform's user & branch directory. Previously
    // any non-super holder of sendGlobalNotifications could enumerate every tenant.
    users = await User.find({
      _id: { $ne: user._id },
      $or: [{ assignedLocation: { $in: branchIds } }, { accessibleLocations: { $in: branchIds } }],
    }).select('name role assignedLocation');
    roles = ['branch_admin', 'location_admin', 'staff', 'chef', 'all'];
    branches = await Location.find({ _id: { $in: branchIds } }).select('name city');
  }
  else if (role === 'admin') {
    // Super admin (up) + everyone in this admin's branches (down).
    const supers = await User.find({ role: 'super_admin' }).select('name role');
    const branchUsers = await User.find({
      assignedLocation: { $in: branchIds },
      role: { $in: ['branch_admin', 'location_admin', 'staff', 'chef'] },
      _id: { $ne: user._id },
    }).select('name role');
    users = [...supers, ...branchUsers];
    // Admins may also broadcast to a whole branch they manage.
    branches = await Location.find({ _id: { $in: branchIds } }).select('name city');
  }
  else if (role === 'branch_admin') {
    // Their admin (up) + their staff/chef/location admin (down). Super admin only
    // when the messageSuperAdmin permission is granted.
    const admins = await User.find({ role: 'admin', accessibleLocations: { $in: branchIds } }).select('name role');
    const staff = await User.find({
      assignedLocation: { $in: branchIds },
      role: { $in: ['staff', 'chef', 'location_admin'] },
      _id: { $ne: user._id },
    }).select('name role');
    const supers = canSuper ? await User.find({ role: 'super_admin' }).select('name role') : [];
    users = [...supers, ...admins, ...staff];
  }
  else {
    // staff / chef / location_admin: their branch admin + their admin. Super admin
    // only with the messageSuperAdmin permission.
    const branchAdmins = await User.find({
      role: 'branch_admin',
      $or: [{ assignedLocation: { $in: branchIds } }, { accessibleLocations: { $in: branchIds } }],
      _id: { $ne: user._id },
    }).select('name role');
    const admins = await User.find({ role: 'admin', accessibleLocations: { $in: branchIds } }).select('name role');
    const supers = canSuper ? await User.find({ role: 'super_admin' }).select('name role') : [];
    users = [...supers, ...admins, ...branchAdmins];
  }

  res.json({
    success: true,
    data: { users, roles, branches }
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  createNotification,
  getTargetOptions
};
