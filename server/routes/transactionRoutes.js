const express = require('express');
const router = express.Router();
const { 
  getTransactions, 
  createTransaction, 
  getTransactionStats 
} = require('../controllers/transactionController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(verifyToken);

router.get('/', getTransactions);
router.get('/stats', getTransactionStats);
router.post('/', upload.single('image'), createTransaction);

module.exports = router;
