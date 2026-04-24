const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updateOrderItems,
  rejectOrder,
  cancelOrder,
  addChefNote,
  completeOrder,
  forceCompleteOrder,
  getOrderAnalytics,
  getMyChefStats,
  getMyStaffStats,
  acceptOrder,
  startPreparing,
  markReady,
  markServed,
  generateOrderBill
} = require('../controllers/orderController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const { validateOrderTransition } = require('../middlewares/omsMiddleware');

router.use(verifyToken);

router.route('/my-stats-chef').get(authorizeRoles('chef'), getMyChefStats);
router.route('/my-stats-staff').get(authorizeRoles('staff', 'branch_admin'), getMyStaffStats);

router
  .route('/')
  .get(getOrders)
  .post(createOrder);

router.get('/analytics', authorizeRoles('super_admin', 'admin', 'branch_admin'), getOrderAnalytics);

router.get('/:id', getOrder);

// Specialized updates with strict OMS validation
router.patch('/:id/status', validateOrderTransition, updateOrderStatus);
router.patch('/:id/items', updateOrderItems);
router.patch('/:id/reject', validateOrderTransition, rejectOrder);
router.patch('/:id/cancel', validateOrderTransition, cancelOrder);
router.patch('/:id/note', addChefNote);
router.patch('/:id/accept', validateOrderTransition, acceptOrder);
router.patch('/:id/start', validateOrderTransition, startPreparing);
router.patch('/:id/ready', validateOrderTransition, markReady);
router.patch('/:id/serve', validateOrderTransition, markServed);
router.patch('/:id/complete', validateOrderTransition, completeOrder);
router.patch('/:id/force-complete', authorizeRoles('super_admin', 'admin', 'branch_admin'), validateOrderTransition, forceCompleteOrder);
router.post('/:id/generate-bill', generateOrderBill);

module.exports = router;
