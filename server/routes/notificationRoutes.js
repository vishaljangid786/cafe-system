const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} = require('../controllers/notificationController');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getNotifications);

router.route('/unread-count')
  .get(getUnreadCount);

router.route('/read-all')
  .patch(markAllAsRead);

router.route('/:id/read')
  .patch(markAsRead);

module.exports = router;
