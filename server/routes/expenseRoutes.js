const express = require('express');
const { addExpense, updateExpense, deleteExpense, getExpenses, updateExpenseStatus } = require('../controllers/expenseController');
const { verifyToken, checkPermissions, checkRoles, checkAction } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(checkPermissions('viewRevenue'), getExpenses)
  .post(checkAction('expenses.add'), upload.single('proofImage'), addExpense);

router.route('/:id')
  .put(checkAction('expenses.modify'), upload.single('proofImage'), updateExpense)
  .delete(checkAction('expenses.delete'), deleteExpense);

// Approval — 'expenses.approve' still passes for editRevenue holders, so existing
// approvers are unaffected; the controller enforces branch scope.
router.patch('/:id/status', checkAction('expenses.approve'), updateExpenseStatus);

module.exports = router;
