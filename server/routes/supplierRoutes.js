const express = require('express');
const router = express.Router();
const { createSupplier, getSuppliers, updateSupplier, deleteSupplier } = require('../controllers/purchaseController');
const { verifyToken, checkRoles, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.route('/')
  .get(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), getSuppliers)
  .post(checkAction('procurement.add'), createSupplier);
router.put('/:id', checkAction('procurement.modify'), updateSupplier);
// The controller re-checks procurement.delete + branch scope: this middleware cannot
// see which record the id resolves to, and a future remount could skip it.
router.delete('/:id', checkAction('procurement.delete'), deleteSupplier);

module.exports = router;
