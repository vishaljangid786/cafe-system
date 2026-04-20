const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all notifications for logged-in user
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const type = req.query.type;

  const matchQuery = { 'recipients.user': req.user._id };
  if (type) {
    matchQuery.type = type;
  }

  // Get total count
  const total = await Notification.countDocuments(matchQuery);

  const notifications = await Notification.find(matchQuery)
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limit);

  // We only want to return the recipient object for the current user
  const formattedNotifications = notifications.map((notif) => {
    const n = notif.toObject();
    const myRecipientObj = n.recipients.find((r) => r.user.toString() === req.user._id.toString());
    n.isRead = myRecipientObj ? myRecipientObj.isRead : false;
    delete n.recipients; // Don't expose all recipients to the user
    return n;
  });

  res.json({
    success: true,
    count: formattedNotifications.length,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: formattedNotifications,
  });
});

// @desc    Mark a specific notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, 'recipients.user': req.user._id },
    { $set: { 'recipients.$.isRead': true } },
    { new: true }
  );

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  res.json({
    success: true,
    message: 'Notification marked as read',
  });
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { 'recipients.user': req.user._id, 'recipients.isRead': false },
    { $set: { 'recipients.$[elem].isRead': true } },
    { arrayFilters: [{ 'elem.user': req.user._id }] }
  );

  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    'recipients': {
      $elemMatch: { user: req.user._id, isRead: false }
    }
  });

  res.json({
    success: true,
    count,
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
