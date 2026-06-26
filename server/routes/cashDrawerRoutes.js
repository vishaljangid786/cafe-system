const express = require('express');
const router = express.Router();
const {
  openDrawer,
  getCurrentDrawer,
  addMovement,
  closeDrawer,
  getDrawerHistory,
} = require('../controllers/cashDrawerController');
const { verifyToken, checkPermissions, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Cashier operations (whoever can take orders can run the drawer; legacy manageOrders still passes).
router.get('/current', checkPermissions('manageOrders'), getCurrentDrawer);
router.post('/open', checkAction('cashdrawer.add'), openDrawer);
router.post('/:id/movement', checkAction('cashdrawer.modify'), addMovement);
router.post('/:id/close', checkAction('cashdrawer.modify'), closeDrawer);

// Z-report history is financial reporting.
router.get('/', checkPermissions('viewRevenue'), getDrawerHistory);

module.exports = router;
