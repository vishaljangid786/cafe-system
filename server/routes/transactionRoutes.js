const express = require('express');
const router = express.Router();
const { 
  getTransactions, 
  createTransaction, 
  getTransactionStats,
  approveTransaction,
  rejectTransaction
} = require('../controllers/transactionController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(verifyToken);

router.get('/', getTransactions);
router.get('/stats', getTransactionStats);
router.post('/', upload.single('image'), createTransaction);

// Approval Workflow
router.patch('/:id/approve', authorizeRoles('super_admin', 'admin', 'branch_admin'), approveTransaction);
router.patch('/:id/reject', authorizeRoles('super_admin', 'admin', 'branch_admin'), rejectTransaction);

module.exports = router;
