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
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/', getNotifications);
// Sending is governed inside the controller by the per-user sendMessages permission
// and the role-based target rules, so these only need an authenticated user.
router.get('/targets', getTargetOptions);
router.post('/', createNotification);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.patch('/:id/unread', markAsUnread);

module.exports = router;
