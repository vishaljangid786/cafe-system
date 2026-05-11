const express = require('express');
const {
  getRecipe,
  upsertRecipe,
  deleteRecipe,
} = require('../controllers/recipeController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .post(checkRoles('super_admin', 'admin', 'branch_admin'), upsertRecipe);

router.route('/:menuItemId')
  .get(getRecipe);

router.route('/:id')
  .delete(checkRoles('super_admin', 'admin', 'branch_admin'), deleteRecipe);

module.exports = router;
