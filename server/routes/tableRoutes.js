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
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getTables)
  .post(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), addTable);

router.route('/:id')
  .get(getTable)
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), updateTable)
  .delete(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), deleteTable);

router.route('/:id/book')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'), bookTable);

router.route('/:id/orders')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'), updateOrders);

router.route('/:id/complete')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'), completeOrder);

router.route('/:id/bill')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'), upload.single('billImage'), uploadBill);

module.exports = router;
