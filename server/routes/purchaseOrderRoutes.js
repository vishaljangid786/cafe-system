const express = require('express');
const router = express.Router();
const {
  createPurchaseOrder,
  getPurchaseOrders,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} = require('../controllers/purchaseController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken, checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'));

router.route('/').get(getPurchaseOrders).post(createPurchaseOrder);
router.patch('/:id/receive', receivePurchaseOrder);
router.patch('/:id/cancel', cancelPurchaseOrder);

module.exports = router;
