const express = require('express');
const router = express.Router();
const {
  issueGiftCard,
  lookupGiftCard,
  redeemGiftCard,
  topupGiftCard,
  getGiftCards,
} = require('../controllers/giftCardController');
const { verifyToken, checkRoles, checkPermissions, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Cashiers can look up + redeem at the register.
router.get('/lookup/:code', checkPermissions('manageOrders'), lookupGiftCard);
router.post('/redeem', checkPermissions('manageOrders'), redeemGiftCard);

// Listing stays an admin-role view; issuing / topping up are grantable per-user
// actions (legacy admin roles still pass via the action's legacy fallback).
router.route('/')
  .get(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), getGiftCards)
  .post(checkAction('giftcards.add'), issueGiftCard);
router.post('/:id/topup', checkAction('giftcards.modify'), topupGiftCard);

module.exports = router;
