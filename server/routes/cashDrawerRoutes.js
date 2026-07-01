const express = require('express');
const router = express.Router();
const {
  openDrawer,
  getCurrentDrawer,
  addMovement,
  closeDrawer,
  getDrawerHistory,
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

module.exports = router;
