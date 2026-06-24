const express = require('express');
const router = express.Router();
const { addToWaitlist, getWaitlist, updateWaitlistEntry } = require('../controllers/waitlistController');
const { verifyToken, checkPermissions } = require('../middlewares/authMiddleware');

router.use(verifyToken, checkPermissions('manageOrders'));

router.route('/').get(getWaitlist).post(addToWaitlist);
router.patch('/:id', updateWaitlistEntry);

module.exports = router;
