const express = require('express');
const {
  getCategories,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getCategories)
  .post(authorizeRoles('super_admin', 'admin', 'branch_admin'), createCategory);

router.route('/all')
  .get(authorizeRoles('super_admin', 'admin', 'branch_admin'), getAllCategories);

router.route('/:id')
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin'), updateCategory)
  .delete(authorizeRoles('super_admin', 'admin', 'branch_admin'), deleteCategory);

module.exports = router;
