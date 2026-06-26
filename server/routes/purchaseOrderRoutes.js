const express = require('express');
const router = express.Router();
const {
  createPurchaseOrder,
  getPurchaseOrders,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} = require('../controllers/purchaseController');
const { verifyToken, checkRoles, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.route('/')
  .get(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), getPurchaseOrders)
  .post(checkAction('procurement.add'), createPurchaseOrder);
router.patch('/:id/receive', checkAction('procurement.modify'), receivePurchaseOrder);
router.patch('/:id/cancel', checkAction('procurement.modify'), cancelPurchaseOrder);

module.exports = router;
