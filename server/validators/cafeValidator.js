const { body } = require('express-validator');

// Shared rules for supplying an admin (inline-new or existing user). The "new"
// rules mirror the Add-Member contract so a cafe admin is created with the same
// completeness (identity, address, Aadhaar) and the same messages.
const onNew = (prefix, field) => body(`${prefix}.${field}`).if(body('adminMode').equals('new'));
const newAdminRules = (prefix = 'admin') => [
  onNew(prefix, 'name').trim().notEmpty().withMessage('Admin name is required')
    .bail().isLength({ min: 2 }).withMessage('Admin name must be at least 2 characters'),
  onNew(prefix, 'email').trim().isEmail().withMessage('A valid admin email is required'),
  onNew(prefix, 'password').isLength({ min: 10 }).withMessage('Admin password must be at least 10 characters'),
  onNew(prefix, 'phone').matches(/^[0-9]{10}$/).withMessage('A valid 10-digit admin phone is required'),
  onNew(prefix, 'gender').optional({ checkFalsy: true }).isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
  onNew(prefix, 'address1').trim().notEmpty().withMessage('Admin address is required'),
  onNew(prefix, 'city').trim().notEmpty().withMessage('Admin city is required'),
  onNew(prefix, 'age').optional({ checkFalsy: true }).isInt({ min: 18, max: 99 }).withMessage('Admin age must be between 18 and 99'),
  onNew(prefix, 'pincode').optional({ checkFalsy: true }).matches(/^[0-9]{6}$/).withMessage('Invalid pincode'),
  onNew(prefix, 'aadharNumber').matches(/^[0-9]{12}$/).withMessage('A valid 12-digit Aadhaar number is required'),
  onNew(prefix, 'aadharImage').trim().notEmpty().withMessage('Aadhaar card image is required'),
  body('adminUserId').if(body('adminMode').equals('existing')).isMongoId()
    .withMessage('Select a valid admin to assign'),
];

// Optional branding-field rules shared by create + update. checkFalsy lets an
// empty string through (treated as "clear this field" by the controller).
const brandingRules = [
  body('gstin').optional({ checkFalsy: true }).trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Invalid GSTIN format'),
  body('logo').optional({ checkFalsy: true }).trim().isURL().withMessage('Logo must be a valid URL'),
  body('address.pincode').optional({ checkFalsy: true }).matches(/^[0-9]{6}$/).withMessage('Invalid pincode'),
  body('contact.email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid contact email'),
  body('contact.phone').optional({ checkFalsy: true }).matches(/^[0-9]{10}$/).withMessage('Invalid contact phone'),
  body('address.line1').optional().trim().isLength({ max: 200 }),
  body('address.line2').optional().trim().isLength({ max: 200 }),
  body('address.city').optional().trim().isLength({ max: 100 }),
  body('address.state').optional().trim().isLength({ max: 100 }),
];

const createCafeValidator = [
  body('name').trim().notEmpty().withMessage('Cafe name is required'),
  body('adminMode').optional().isIn(['new', 'existing', 'none']).withMessage('Invalid admin option'),
  ...brandingRules,
  ...newAdminRules(),
];

const updateCafeValidator = [
  body('name').optional().trim().notEmpty().withMessage('Cafe name cannot be empty'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status'),
  ...brandingRules,
];

const addAdminValidator = [
  body('adminMode').isIn(['new', 'existing']).withMessage('Choose a new or existing admin'),
  ...newAdminRules(),
];

module.exports = { createCafeValidator, updateCafeValidator, addAdminValidator };
