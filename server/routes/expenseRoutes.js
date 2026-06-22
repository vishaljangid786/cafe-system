const express = require('express');
const { addExpense, updateExpense, deleteExpense, getExpenses, updateExpenseStatus } = require('../controllers/expenseController');
const { verifyToken, checkPermissions, checkRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(checkPermissions('viewRevenue'), getExpenses)
  .post(checkPermissions('editRevenue'), upload.single('proofImage'), addExpense);

router.route('/:id')
  .put(checkPermissions('editRevenue'), upload.single('proofImage'), updateExpense)
  .delete(checkPermissions('editRevenue'), deleteExpense);

router.patch('/:id/status', checkRoles('super_admin', 'admin', 'branch_admin'), updateExpenseStatus);

module.exports = router;
