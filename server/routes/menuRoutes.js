const express = require('express');
const {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
  updateStock,
} = require('../controllers/menuItemController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { menuItemSchema, validate } = require('../middlewares/validateMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getMenuItems)
  .post(
    authorizeRoles('super_admin', 'admin', 'branch_admin'),
    upload.single('image'),
    ...menuItemSchema,
    validate,
    createMenuItem
  );

router.route('/:id')
  .get(getMenuItem)
  .put(
    authorizeRoles('super_admin', 'admin', 'branch_admin'),
    upload.single('image'),
    ...menuItemSchema,
    validate,
    updateMenuItem
  )
  .delete(authorizeRoles('super_admin', 'admin', 'branch_admin'), deleteMenuItem);

router.route('/:id/availability')
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin', 'chef', 'staff'), toggleAvailability);

router.route('/:id/stock')
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin', 'chef', 'staff'), updateStock);

module.exports = router;
