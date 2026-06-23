const express = require('express');
const router = express.Router();
const { 
  getTransactions, 
  createTransaction, 
  getTransactionStats,
  approveTransaction,
  rejectTransaction
} = require('../controllers/transactionController');
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(verifyToken);

router.get('/', checkPermissions('viewRevenue'), getTransactions);
router.get('/stats', checkPermissions('viewRevenue'), getTransactionStats);
router.post('/', checkPermissions('editRevenue'), upload.single('image'), createTransaction);

// Approval Workflow
// location_admin removed (its default editRevenue is false); approvers must also
// hold the editRevenue permission so financial approvals can't be bypassed.
router.patch('/:id/approve', checkRoles('super_admin', 'admin', 'branch_admin'), checkPermissions('editRevenue'), approveTransaction);
router.patch('/:id/reject', checkRoles('super_admin', 'admin', 'branch_admin'), checkPermissions('editRevenue'), rejectTransaction);

module.exports = router;
