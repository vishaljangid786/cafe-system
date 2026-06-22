const Order = require('../models/Order');
const { enforceLocationAccess } = require('../utils/accessControl');

/**
 * STRICT OMS LIFECYCLE:
 * PLACED → ACCEPTED → PREPARING → READY → SERVED → COMPLETED
 */

const ALLOWED_TRANSITIONS = {
  'PLACED': ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  'ACCEPTED': ['PREPARING', 'CANCELLED'],
  'PREPARING': ['READY', 'CANCELLED'],
  'READY': ['SERVED', 'CANCELLED'],
  'SERVED': ['COMPLETED', 'CANCELLED'],
  'REJECTED': [],
  'CANCELLED': [],
  'COMPLETED': []
};

const ROLE_PERMISSIONS = {
  'ACCEPTED': ['chef', 'admin', 'super_admin', 'branch_admin'],
  'PREPARING': ['chef', 'admin', 'super_admin', 'branch_admin'],
  'READY': ['chef', 'admin', 'super_admin', 'branch_admin'],
  'SERVED': ['staff', 'admin', 'super_admin', 'branch_admin'],
  'COMPLETED': ['staff', 'admin', 'super_admin', 'branch_admin'],
  'REJECTED': ['chef', 'admin', 'super_admin', 'branch_admin'],
  'CANCELLED': ['admin', 'super_admin', 'branch_admin']
};

const validateOrderTransition = async (req, res, next) => {
  // Ensure req.body exists to prevent destructuring errors
  req.body = req.body || {};

  // Infer nextStatus from URL if not explicitly provided in body (for specialized endpoints)
  if (!req.body.status) {
    const path = (req.originalUrl || req.path).split('?')[0]; // Strip query params
    if (path.endsWith('/accept')) req.body.status = 'ACCEPTED';
    else if (path.endsWith('/start')) req.body.status = 'PREPARING';
    else if (path.endsWith('/ready')) req.body.status = 'READY';
    else if (path.endsWith('/serve')) req.body.status = 'SERVED';
    else if (path.endsWith('/complete')) req.body.status = 'COMPLETED';
    else if (path.endsWith('/cancel')) req.body.status = 'CANCELLED';
    else if (path.endsWith('/reject')) req.body.status = 'REJECTED';
    else if (path.endsWith('/force-complete')) req.body.status = 'COMPLETED';
  }

  const { status: nextStatus } = req.body;
  const { id } = req.params;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    enforceLocationAccess(req, res, order.branch, 'Permission denied to this order');

    const currentStatus = order.status;
    const isForceComplete = (req.originalUrl || req.path).includes('/force-complete');

    // Idempotency: If the status is already what we want, just return success
    if (currentStatus === nextStatus) {
      return res.json({ success: true, data: order, message: 'Order is already in this status' });
    }

    const isTerminal = ['CANCELLED', 'REJECTED', 'COMPLETED'].includes(currentStatus);

    // 1. Check if the transition is logically allowed
    // Note: Force-complete is allowed from any non-terminal state by admins
    if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
      if (!(isForceComplete && !isTerminal)) {
        console.error(`[OMS_PROTOCOL_VIOLATION] Order: ${id} - Attempted: ${currentStatus} -> ${nextStatus} - ForceComplete: ${isForceComplete}`);
        return res.status(400).json({
          success: false,
          message: `Cannot change order from ${currentStatus} to ${nextStatus}`
        });
      }
    }

    // 2. Check if the user role has permission for this status
    if (!ROLE_PERMISSIONS[nextStatus].includes(req.user.role)) {
      console.error(`[OMS_JURISDICTION_ERROR] User: ${req.user.role} - Target Status: ${nextStatus}`);
      return res.status(403).json({
        success: false,
        message: `Order Error: ${req.user.role.toUpperCase()} cannot allow ${nextStatus} change`
      });
    }

    // Attach order to request for controller use
    req.omsOrder = order;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { validateOrderTransition };
