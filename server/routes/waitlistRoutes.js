const express = require('express');
const router = express.Router();
const { addToWaitlist, getWaitlist, updateWaitlistEntry, deleteWaitlistEntry } = require('../controllers/waitlistController');
const { verifyToken, checkPermissions, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.route('/')
  .get(checkPermissions('manageOrders'), getWaitlist)
  .post(checkAction('waitlist.add'), addToWaitlist);
router.patch('/:id', checkAction('waitlist.modify'), updateWaitlistEntry);
router.delete('/:id', checkAction('waitlist.delete'), deleteWaitlistEntry);

module.exports = router;
