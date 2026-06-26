const express = require('express');
const router = express.Router();
const { addToWaitlist, getWaitlist, updateWaitlistEntry } = require('../controllers/waitlistController');
const { verifyToken, checkPermissions, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.route('/')
  .get(checkPermissions('manageOrders'), getWaitlist)
  .post(checkAction('waitlist.add'), addToWaitlist);
router.patch('/:id', checkAction('waitlist.modify'), updateWaitlistEntry);

module.exports = router;
