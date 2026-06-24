const { body } = require('express-validator');

// Shared rules for supplying an admin (inline-new or existing user).
const newAdminRules = (prefix = 'admin') => [
  body(`${prefix}.name`).if(body('adminMode').equals('new')).trim().notEmpty()
    .withMessage('Admin name is required'),
  body(`${prefix}.email`).if(body('adminMode').equals('new')).trim().isEmail()
    .withMessage('A valid admin email is required'),
  body(`${prefix}.password`).if(body('adminMode').equals('new')).isLength({ min: 6 })
    .withMessage('Admin password must be at least 6 characters'),
  body(`${prefix}.phone`).if(body('adminMode').equals('new')).matches(/^[0-9]{10}$/)
    .withMessage('A valid 10-digit admin phone is required'),
  body('adminUserId').if(body('adminMode').equals('existing')).isMongoId()
    .withMessage('Select a valid user to assign as admin'),
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
