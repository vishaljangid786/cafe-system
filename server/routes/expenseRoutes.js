const express = require('express');
const { addExpense, updateExpense, deleteExpense, getExpenses } = require('../controllers/expenseController');
const { verifyToken, authorizePermissions } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(authorizePermissions('viewRevenue'), getExpenses)
  .post(authorizePermissions('editRevenue'), upload.single('proofImage'), addExpense);

router.route('/:id')
  .put(authorizePermissions('editRevenue'), upload.single('proofImage'), updateExpense)
  .delete(authorizePermissions('editRevenue'), deleteExpense);

module.exports = router;
