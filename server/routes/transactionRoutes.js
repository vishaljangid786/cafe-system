const express = require('express');
const router = express.Router();
const { 
  getTransactions, 
  createTransaction, 
  getTransactionStats,
  approveTransaction,
  rejectTransaction
} = require('../controllers/transactionController');
const { verifyToken, authorizeRoles, authorizePermissions } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(verifyToken);

router.get('/', authorizePermissions('viewRevenue'), getTransactions);
router.get('/stats', authorizePermissions('viewRevenue'), getTransactionStats);
router.post('/', authorizePermissions('editRevenue'), upload.single('image'), createTransaction);

// Approval Workflow
router.patch('/:id/approve', authorizeRoles('super_admin', 'admin', 'branch_admin'), authorizePermissions('editRevenue'), approveTransaction);
router.patch('/:id/reject', authorizeRoles('super_admin', 'admin', 'branch_admin'), authorizePermissions('editRevenue'), rejectTransaction);

module.exports = router;
