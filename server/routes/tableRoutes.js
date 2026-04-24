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
  .put(bookTable);

router.route('/:id/orders')
  .put(updateOrders);

router.route('/:id/complete')
  .put(completeOrder);

router.route('/:id/bill')
  .put(upload.single('billImage'), uploadBill);

module.exports = router;
