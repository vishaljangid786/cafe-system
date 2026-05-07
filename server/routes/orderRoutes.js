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
const { verifyToken, authorizeRoles, authorizePermissions } = require('../middlewares/authMiddleware');

const { validateOrderTransition } = require('../middlewares/omsMiddleware');

router.use(verifyToken);

router.route('/my-stats-chef').get(authorizeRoles('chef'), getMyChefStats);
router.route('/my-stats-staff').get(authorizeRoles('staff', 'branch_admin'), getMyStaffStats);

router
  .route('/')
  .get(authorizePermissions('viewOrders'), getOrders)
  .post(authorizePermissions('manageOrders'), createOrder);

router.get('/analytics', authorizeRoles('super_admin', 'admin', 'branch_admin'), authorizePermissions('viewAnalytics'), getOrderAnalytics);

router.get('/:id', authorizePermissions('viewOrders'), getOrder);

// Specialized updates with strict OMS validation
router.patch('/:id/status', authorizePermissions('manageOrders'), validateOrderTransition, updateOrderStatus);
router.patch('/:id/items', authorizePermissions('manageOrders'), updateOrderItems);
router.patch('/:id/reject', authorizePermissions('manageOrders'), validateOrderTransition, rejectOrder);
router.patch('/:id/cancel', authorizePermissions('manageOrders'), validateOrderTransition, cancelOrder);
router.patch('/:id/note', authorizePermissions('manageOrders'), addChefNote);
router.patch('/:id/accept', authorizePermissions('manageOrders'), validateOrderTransition, acceptOrder);
router.patch('/:id/start', authorizePermissions('manageOrders'), validateOrderTransition, startPreparing);
router.patch('/:id/ready', authorizePermissions('manageOrders'), validateOrderTransition, markReady);
router.patch('/:id/serve', authorizePermissions('manageOrders'), validateOrderTransition, markServed);
router.patch('/:id/complete', authorizePermissions('manageOrders'), validateOrderTransition, completeOrder);
router.patch('/:id/force-complete', authorizeRoles('super_admin', 'admin', 'branch_admin'), authorizePermissions('forceComplete'), validateOrderTransition, forceCompleteOrder);
router.post('/:id/generate-bill', authorizePermissions('manageOrders'), generateOrderBill);

module.exports = router;
