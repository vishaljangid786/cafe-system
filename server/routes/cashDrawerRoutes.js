const express = require('express');
const router = express.Router();
const {
  openDrawer,
  getCurrentDrawer,
  addMovement,
  closeDrawer,
  getDrawerHistory,
  deleteSession,
} = require('../controllers/cashDrawerController');
const { verifyToken, checkPermissions, checkAnyPermission, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Reading the live drawer is allowed for cashiers (manageOrders) AND for anyone who
// can view revenue (admins/owners) — the latter get a read-only view for the
// Overview cash-drawer widget without needing order-taking rights. Writes below
// still require the cashier action gates.
router.get('/current', checkAnyPermission('manageOrders', 'viewRevenue'), getCurrentDrawer);
router.post('/open', checkAction('cashdrawer.add'), openDrawer);
router.post('/:id/movement', checkAction('cashdrawer.modify'), addMovement);
router.post('/:id/close', checkAction('cashdrawer.modify'), closeDrawer);

// Z-report history is financial reporting.
router.get('/', checkPermissions('viewRevenue'), getDrawerHistory);

// Removing a shift erases a cash reconciliation, so it is gated separately from the
// cashier writes above. The controller re-checks the action AND branch scope, and
// refuses an open drawer outright / limits closed shifts to super admins.
router.delete('/:id', checkAction('cashdrawer.delete'), deleteSession);

module.exports = router;
