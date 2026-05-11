const { body } = require('express-validator');

const createOrderValidator = [
  body('table')
    .notEmpty()
    .withMessage('Table ID is required')
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
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('paymentType')
    .optional()
    .isIn(['CASH', 'UPI', 'CARD', 'ONLINE', 'OTHER'])
    .withMessage('Invalid payment type')
];

const updateOrderStatusValidator = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED', 'REJECTED'])
    .withMessage('Invalid status')
];

module.exports = {
  createOrderValidator,
  updateOrderStatusValidator
};
