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

const createCafeValidator = [
  body('name').trim().notEmpty().withMessage('Cafe name is required'),
  body('adminMode').optional().isIn(['new', 'existing', 'none']).withMessage('Invalid admin option'),
  ...newAdminRules(),
];

const updateCafeValidator = [
  body('name').optional().trim().notEmpty().withMessage('Cafe name cannot be empty'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status'),
];

const addAdminValidator = [
  body('adminMode').isIn(['new', 'existing']).withMessage('Choose a new or existing admin'),
  ...newAdminRules(),
];

module.exports = { createCafeValidator, updateCafeValidator, addAdminValidator };
