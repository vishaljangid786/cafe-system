const express = require('express');
const router = express.Router();
const { createSupplier, getSuppliers, updateSupplier } = require('../controllers/purchaseController');
const { verifyToken, checkRoles, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.route('/')
  .get(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), getSuppliers)
  .post(checkAction('procurement.add'), createSupplier);
router.put('/:id', checkAction('procurement.modify'), updateSupplier);

module.exports = router;
