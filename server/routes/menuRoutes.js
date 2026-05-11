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
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { menuItemSchema, validate } = require('../middlewares/validateMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getMenuItems)
  .post(
    checkRoles('super_admin', 'admin', 'branch_admin'),
    upload.single('image'),
    ...menuItemSchema,
    validate,
    createMenuItem
  );

router.route('/:id')
  .get(getMenuItem)
  .put(
    checkRoles('super_admin', 'admin', 'branch_admin'),
    upload.single('image'),
    ...menuItemSchema,
    validate,
    updateMenuItem
  )
  .delete(checkRoles('super_admin', 'admin', 'branch_admin'), deleteMenuItem);

router.route('/:id/availability')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'chef', 'staff'), toggleAvailability);

router.route('/:id/stock')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'chef', 'staff'), updateStock);

module.exports = router;
