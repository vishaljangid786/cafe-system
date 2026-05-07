const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  createNotification,
  getTargetOptions
} = require('../controllers/notificationController');
const { verifyToken, authorizePermissions } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/', getNotifications);
router.get('/targets', authorizePermissions('manageNotifications'), getTargetOptions);
router.post('/', authorizePermissions('manageNotifications'), createNotification);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

module.exports = router;
