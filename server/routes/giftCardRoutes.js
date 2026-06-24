const express = require('express');
const router = express.Router();
const {
  issueGiftCard,
  lookupGiftCard,
  redeemGiftCard,
  topupGiftCard,
  getGiftCards,
} = require('../controllers/giftCardController');
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Cashiers can look up + redeem at the register.
router.get('/lookup/:code', checkPermissions('manageOrders'), lookupGiftCard);
router.post('/redeem', checkPermissions('manageOrders'), redeemGiftCard);

// Issuing / topping up / listing is an admin function.
router.use(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'));
router.route('/').get(getGiftCards).post(issueGiftCard);
router.post('/:id/topup', topupGiftCard);

module.exports = router;
