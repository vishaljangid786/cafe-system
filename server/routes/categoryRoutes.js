const express = require('express');
const {
  getCategories,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getCategories)
  .post(checkRoles('super_admin', 'admin', 'branch_admin'), createCategory);

router.route('/all')
  .get(checkRoles('super_admin', 'admin', 'branch_admin'), getAllCategories);

router.route('/:id')
  .put(checkRoles('super_admin', 'admin', 'branch_admin'), updateCategory)
  .delete(checkRoles('super_admin', 'admin', 'branch_admin'), deleteCategory);

module.exports = router;
