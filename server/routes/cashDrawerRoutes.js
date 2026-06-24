const express = require('express');
const router = express.Router();
const {
  openDrawer,
  getCurrentDrawer,
  addMovement,
  closeDrawer,
  getDrawerHistory,
} = require('../controllers/cashDrawerController');
const { verifyToken, checkPermissions } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Cashier operations (whoever can take orders can run the drawer).
router.get('/current', checkPermissions('manageOrders'), getCurrentDrawer);
router.post('/open', checkPermissions('manageOrders'), openDrawer);
router.post('/:id/movement', checkPermissions('manageOrders'), addMovement);
router.post('/:id/close', checkPermissions('manageOrders'), closeDrawer);

// Z-report history is financial reporting.
router.get('/', checkPermissions('viewRevenue'), getDrawerHistory);

module.exports = router;
