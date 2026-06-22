const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  createNotification,
  getTargetOptions,
  markAsUnread
} = require('../controllers/notificationController');
const { verifyToken, checkAnyPermission } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/', getNotifications);
router.get('/targets', checkAnyPermission('manageNotifications', 'sendGlobalNotifications'), getTargetOptions);
router.post('/', checkAnyPermission('manageNotifications', 'sendGlobalNotifications'), createNotification);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.patch('/:id/unread', markAsUnread);

module.exports = router;
