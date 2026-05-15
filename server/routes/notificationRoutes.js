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
const { verifyToken, checkPermissions } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/', getNotifications);
router.get('/targets', checkPermissions('manageNotifications'), getTargetOptions);
router.post('/', createNotification);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.patch('/:id/unread', markAsUnread);

module.exports = router;
