const express = require('express');
const router = express.Router();
const { 
  getTransactions, 
  createTransaction, 
  getTransactionStats,
  approveTransaction,
  rejectTransaction
} = require('../controllers/transactionController');
const { verifyToken, checkRoles, checkPermissions, checkAction } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(verifyToken);

router.get('/', checkPermissions('viewRevenue'), getTransactions);
router.get('/stats', checkPermissions('viewRevenue'), getTransactionStats);
router.post('/', checkAction('revenue.add'), upload.single('image'), createTransaction);

// Approval Workflow — gated by the granular 'revenue.approve' action (which still
// passes for editRevenue holders, so existing approvers are unaffected) so a super
// admin can grant approval rights to a specific user. The controller continues to
// enforce branch scope + segregation of duties (you can't approve your own entry).
router.patch('/:id/approve', checkAction('revenue.approve'), approveTransaction);
router.patch('/:id/reject', checkAction('revenue.approve'), rejectTransaction);

module.exports = router;
