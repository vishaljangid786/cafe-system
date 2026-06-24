const express = require('express');
const router = express.Router();
const { createSupplier, getSuppliers, updateSupplier } = require('../controllers/purchaseController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken, checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'));

router.route('/').get(getSuppliers).post(createSupplier);
router.put('/:id', updateSupplier);

module.exports = router;
