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
  mergeTable,
  cancelTable,
  updateTable
} = require('../controllers/tableController');
const { verifyToken, checkRoles, checkAction } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getTables)
  .post(checkAction('tables.add'), addTable);

router.route('/:id')
  .get(getTable)
  .put(checkAction('tables.modify'), updateTable)
  .delete(checkAction('tables.delete'), deleteTable);

router.route('/:id/book')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'), bookTable);

router.route('/:id/orders')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'), updateOrders);

router.route('/:id/complete')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'), completeOrder);

router.route('/:id/merge')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'), mergeTable);

router.route('/:id/bill')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'), upload.single('billImage'), uploadBill);

router.route('/:id/cancel')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'), cancelTable);

module.exports = router;
