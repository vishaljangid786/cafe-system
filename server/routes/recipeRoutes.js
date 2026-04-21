const express = require('express');
const {
  getRecipe,
  upsertRecipe,
  deleteRecipe,
} = require('../controllers/recipeController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .post(authorizeRoles('super_admin', 'admin', 'location_admin'), upsertRecipe);

router.route('/:menuItemId')
  .get(getRecipe);

router.route('/:id')
  .delete(authorizeRoles('super_admin', 'admin', 'location_admin'), deleteRecipe);

module.exports = router;
