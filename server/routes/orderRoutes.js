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
  generateOrderBill,
  deleteOrder
} = require('../controllers/orderController');
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');

const { validateOrderTransition } = require('../middlewares/omsMiddleware');
const validate = require('../middlewares/validatorMiddleware');
const { createOrderValidator, updateOrderItemsValidator, updateOrderStatusValidator } = require('../validators/orderValidator');

router.use(verifyToken);

router.route('/my-stats-chef').get(checkRoles('chef'), getMyChefStats);
router.route('/my-stats-staff').get(checkRoles('staff', 'branch_admin'), getMyStaffStats);

router
  .route('/')
  .get(checkPermissions('viewOrders'), getOrders)
  .post(checkPermissions('manageOrders'), createOrderValidator, validate, createOrder);

router.get('/analytics', checkRoles('super_admin', 'admin', 'branch_admin'), checkPermissions('viewAnalytics'), getOrderAnalytics);

router
  .route('/:id')
  .get(checkPermissions('viewOrders'), getOrder)
  .delete(checkRoles('super_admin', 'admin'), deleteOrder);

// Specialized updates with strict OMS validation
router.patch('/:id/status', checkPermissions('manageOrders'), updateOrderStatusValidator, validate, validateOrderTransition, updateOrderStatus);
router.patch('/:id/items', checkPermissions('manageOrders'), updateOrderItemsValidator, validate, updateOrderItems);
router.patch('/:id/reject', checkPermissions('manageOrders'), validateOrderTransition, rejectOrder);
router.patch('/:id/cancel', checkPermissions('manageOrders'), validateOrderTransition, cancelOrder);
router.patch('/:id/note', checkPermissions('manageOrders'), addChefNote);
router.patch('/:id/accept', checkPermissions('manageOrders'), validateOrderTransition, acceptOrder);
router.patch('/:id/start', checkPermissions('manageOrders'), validateOrderTransition, startPreparing);
router.patch('/:id/ready', checkPermissions('manageOrders'), validateOrderTransition, markReady);
router.patch('/:id/serve', checkPermissions('manageOrders'), validateOrderTransition, markServed);
router.patch('/:id/complete', checkPermissions('manageOrders'), validateOrderTransition, completeOrder);
router.patch('/:id/force-complete', checkPermissions('forceComplete'), validateOrderTransition, forceCompleteOrder);
router.post('/:id/generate-bill', checkPermissions('manageOrders'), generateOrderBill);

module.exports = router;
