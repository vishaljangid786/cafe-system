const { validationResult, body, param, query } = require('express-validator');

// Generic error handler for express-validator
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

  return res.status(422).json({
    success: false,
    errors: extractedErrors,
    message: errors.array()[0].msg // Primary error message
  });
};

// Validation schemas
const loginSchema = [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const signupSchema = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters'),
  body('phone').isString().bail().notEmpty().withMessage('Phone number is required').matches(/^[0-9]{10}$/).withMessage('Please provide a valid 10-digit phone number'),
  body('gender').notEmpty().withMessage('Gender is required').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender selection'),
  body('address1').trim().notEmpty().withMessage('Primary address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
];

const menuItemSchema = [
  body('name').trim().notEmpty().withMessage('Item name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('originalPrice').optional().isFloat({ min: 0 }).withMessage('Original price must be a positive number'),
  body('discountedPrice').optional().isFloat({ min: 0 }).withMessage('Discounted price must be a positive number')
    .custom((value, { req }) => {
      if (value && req.body.originalPrice && value >= req.body.originalPrice) {
        throw new Error('Discounted price must be less than original price');
      }
      return true;
    }),
  body('category').notEmpty().withMessage('Category is required'),
];

const locationSchema = [
  body('name').trim().notEmpty().withMessage('Location name is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('pincode').isString().bail().isPostalCode('IN').withMessage('Please provide a valid Indian pincode'),
];

const updateLocationSchema = [
  body('name').optional().trim().notEmpty().withMessage('Location name cannot be empty'),
  body('city').optional().trim().notEmpty().withMessage('City cannot be empty'),
  body('state').optional().trim().notEmpty().withMessage('State cannot be empty'),
  body('pincode').optional().isString().bail().isPostalCode('IN').withMessage('Please provide a valid Indian pincode'),
  body('status').optional().isIn(['active', 'inactive', 'hold']).withMessage('Invalid status'),
];

// Convert an "HH:mm" string into minutes-since-midnight for safe ordering.
const timeToMinutes = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};

const bookingSchema = [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('startTime').isString().bail().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time required (HH:mm)'),
  body('endTime').isString().bail().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time required (HH:mm)')
    .bail()
    .custom((value, { req }) => {
      const start = req.body.startTime;
      // Only compare when both are well-formed times; the start-time validator
      // reports its own error otherwise.
      if (typeof start === 'string' && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(start)) {
        if (timeToMinutes(value) <= timeToMinutes(start)) {
          throw new Error('End time must be after start time');
        }
      }
      return true;
    }),
  body('numberOfGuests').isInt({ min: 1 }).withMessage('At least 1 guest required'),
];

const couponSchema = [
  body('code').isString().bail().trim().notEmpty().withMessage('Coupon code is required').isUppercase().withMessage('Code must be uppercase'),
  body('discountType').isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
  body('discountValue').isFloat({ min: 0 }).withMessage('Discount value must be positive'),
  body('expiryDate').isISO8601().withMessage('Valid expiry date required').custom((value) => {
    if (new Date(value) <= new Date()) {
      throw new Error('Expiry date must be in the future');
    }
    return true;
  }),
];

module.exports = {
  validate,
  loginSchema,
  signupSchema,
  menuItemSchema,
  locationSchema,
  updateLocationSchema,
  bookingSchema,
  couponSchema
};
