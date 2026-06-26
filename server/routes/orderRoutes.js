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
  recordPayment,
  refundOrder,
  getGstReport,
  updateItemStatus,
  moveOrderTable,
  splitOrder,
  reorderOrder,
  deleteOrder
} = require('../controllers/orderController');
const { verifyToken, checkRoles, checkPermissions, checkAction } = require('../middlewares/authMiddleware');

const { validateOrderTransition } = require('../middlewares/omsMiddleware');
const validate = require('../middlewares/validatorMiddleware');
const { createOrderValidator, updateOrderItemsValidator, updateOrderStatusValidator } = require('../validators/orderValidator');

router.use(verifyToken);

router.route('/my-stats-chef').get(checkRoles('chef'), getMyChefStats);
router.route('/my-stats-staff').get(checkRoles('staff', 'branch_admin'), getMyStaffStats);

router
  .route('/')
  .get(checkPermissions('viewOrders'), getOrders)
  .post(checkAction('orders.add'), createOrderValidator, validate, createOrder);

router.get('/analytics', checkRoles('super_admin', 'admin', 'branch_admin'), checkPermissions('viewAnalytics'), getOrderAnalytics);
router.get('/gst-report', checkPermissions('viewRevenue'), getGstReport);

router
  .route('/:id')
  .get(checkPermissions('viewOrders'), getOrder)
  .delete(checkAction('orders.delete'), deleteOrder);

// Specialized updates with strict OMS validation
router.patch('/:id/status', checkAction('orders.modify'), updateOrderStatusValidator, validate, validateOrderTransition, updateOrderStatus);
router.patch('/:id/items', checkAction('orders.modify'), updateOrderItemsValidator, validate, updateOrderItems);
router.patch('/:id/reject', checkAction('orders.modify'), validateOrderTransition, rejectOrder);
router.patch('/:id/cancel', checkAction('orders.modify'), validateOrderTransition, cancelOrder);
router.patch('/:id/note', checkAction('orders.modify'), addChefNote);
router.patch('/:id/accept', checkAction('orders.modify'), validateOrderTransition, acceptOrder);
router.patch('/:id/start', checkAction('orders.modify'), validateOrderTransition, startPreparing);
router.patch('/:id/ready', checkAction('orders.modify'), validateOrderTransition, markReady);
router.patch('/:id/serve', checkAction('orders.modify'), validateOrderTransition, markServed);
router.patch('/:id/complete', checkAction('orders.modify'), validateOrderTransition, completeOrder);
router.patch('/:id/force-complete', checkPermissions('forceComplete'), validateOrderTransition, forceCompleteOrder);
router.patch('/:id/item-status', checkAction('orders.modify'), updateItemStatus);
router.patch('/:id/move-table', checkAction('orders.modify'), moveOrderTable);
router.post('/:id/split', checkAction('orders.modify'), splitOrder);
router.post('/:id/reorder', checkAction('orders.modify'), reorderOrder);
router.patch('/:id/payment', checkAction('orders.modify'), recordPayment);
router.patch('/:id/refund', checkAction('revenue.modify'), refundOrder);
router.post('/:id/generate-bill', checkAction('orders.modify'), generateOrderBill);

module.exports = router;
