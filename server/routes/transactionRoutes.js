const express = require('express');
const router = express.Router();
const {
  getTransactions,
  createTransaction,
  splitTransaction,
  createBulkRevenue,
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

// Split one expense across several branches. Uses the same 'revenue.add' gate as a
// normal New Entry (it lives in that same modal); the controller further restricts
// this to admins/super_admin and validates access to every target branch.
router.post('/split', checkAction('revenue.add'), splitTransaction);

// Add manual revenue to one or many branches (a separate amount per branch, one
// shared reason). Admins post as approved; others granted revenue.add go pending.
// The controller validates access to every target branch.
router.post('/revenue/bulk', checkAction('revenue.add'), createBulkRevenue);

// Approval Workflow — gated by the granular 'revenue.approve' action (which still
// passes for editRevenue holders, so existing approvers are unaffected) so a super
// admin can grant approval rights to a specific user. The controller continues to
// enforce branch scope + segregation of duties (you can't approve your own entry).
router.patch('/:id/approve', checkAction('revenue.approve'), approveTransaction);
router.patch('/:id/reject', checkAction('revenue.approve'), rejectTransaction);

module.exports = router;
