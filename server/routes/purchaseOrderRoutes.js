const express = require('express');
const router = express.Router();
const {
  createPurchaseOrder,
  getPurchaseOrders,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  deletePurchaseOrder,
} = require('../controllers/purchaseController');
const { verifyToken, checkRoles, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.route('/')
  .get(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), getPurchaseOrders)
  .post(checkAction('procurement.add'), createPurchaseOrder);
router.patch('/:id/receive', checkAction('procurement.modify'), receivePurchaseOrder);
router.patch('/:id/cancel', checkAction('procurement.modify'), cancelPurchaseOrder);
// The controller re-checks procurement.delete + branch scope: this middleware cannot
// see which record the id resolves to, and a future remount could skip it.
router.delete('/:id', checkAction('procurement.delete'), deletePurchaseOrder);

module.exports = router;
