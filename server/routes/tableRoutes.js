const express = require('express');
const { 
  getTables, 
  getTable,
  addTable, 
  bookTable, 
  updateOrders, 
  uploadBill, 
  deleteTable,
  completeOrder,
  updateTable
} = require('../controllers/tableController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getTables)
  .post(authorizeRoles('super_admin', 'admin', 'branch_admin'), addTable);

router.route('/:id')
  .get(getTable)
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin'), updateTable)
  .delete(authorizeRoles('super_admin', 'admin', 'branch_admin'), deleteTable);

router.route('/:id/book')
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin', 'staff', 'chef'), bookTable);

router.route('/:id/orders')
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin', 'staff', 'chef'), updateOrders);

router.route('/:id/complete')
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin', 'staff', 'chef'), completeOrder);

router.route('/:id/bill')
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin', 'staff', 'chef'), upload.single('billImage'), uploadBill);

module.exports = router;
