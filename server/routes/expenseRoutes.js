const express = require('express');
const { addExpense, updateExpense, deleteExpense, getExpenses } = require('../controllers/expenseController');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getExpenses)
  .post(upload.single('proofImage'), addExpense);

router.route('/:id')
  .put(upload.single('proofImage'), updateExpense)
  .delete(deleteExpense);

module.exports = router;
