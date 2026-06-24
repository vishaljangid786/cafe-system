const { body } = require('express-validator');

const createOrderValidator = [
  body('orderType')
    .optional()
    .isIn(['dine-in', 'takeaway', 'delivery'])
    .withMessage('Invalid order type'),
  // Table is required only for dine-in; takeaway/delivery have no table.
  body('table')
    .if((value, { req }) => (req.body.orderType || 'dine-in') === 'dine-in')
    .notEmpty()
    .withMessage('Table ID is required')
    .bail()
    .isMongoId()
    .withMessage('Invalid Table ID format'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.menuItem')
    .notEmpty()
    .withMessage('Menu Item ID is required')
    .isMongoId()
    .withMessage('Invalid Menu Item ID format'),
  body('items.*.quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1, max: 999 })
    .withMessage('Quantity must be between 1 and 999'),
  body('paymentType')
    .optional()
    .isIn(['CASH', 'UPI', 'CARD', 'ONLINE', 'OTHER'])
    .withMessage('Invalid payment type')
];

// Reuses the create-order item shape for the modify-items endpoint.
const updateOrderItemsValidator = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.menuItem')
    .notEmpty()
    .withMessage('Menu Item ID is required')
    .isMongoId()
    .withMessage('Invalid Menu Item ID format'),
  body('items.*.quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1, max: 999 })
    .withMessage('Quantity must be between 1 and 999')
];

const updateOrderStatusValidator = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'])
    .withMessage('Invalid status')
];

module.exports = {
  createOrderValidator,
  updateOrderItemsValidator,
  updateOrderStatusValidator
};
