const Recipe = require('../models/Recipe');
const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get recipe for a menu item
// @route   GET /api/recipes/:menuItemId
// @access  Private
const getRecipe = asyncHandler(async (req, res) => {
  const recipe = await Recipe.findOne({ menuItemId: req.params.menuItemId });
  
  if (!recipe) {
    res.status(404);
    throw new Error('Recipe not found for this item');
  }

  res.json({
    success: true,
    data: recipe,
  });
});

// @desc    Create or update recipe
// @route   POST /api/recipes
// @access  Private (Admin, Location Admin)
const upsertRecipe = asyncHandler(async (req, res) => {
  const { menuItemId, ingredients, instructions, notes } = req.body;

  const item = await MenuItem.findById(menuItemId);
  if (!item) {
    res.status(404);
    throw new Error('Menu item not found');
  }

  let recipe = await Recipe.findOne({ menuItemId });

  if (recipe) {
    recipe.ingredients = ingredients;
    recipe.instructions = instructions;
    recipe.notes = notes;
    await recipe.save();
  } else {
    recipe = await Recipe.create({
      menuItemId,
      ingredients,
      instructions,
      notes,
      createdBy: req.user._id,
    });
    
    // Link to MenuItem
    item.recipeId = recipe._id;
    await item.save();
  }

  res.status(201).json({
    success: true,
    data: recipe,
  });
});

// @desc    Delete recipe
// @route   DELETE /api/recipes/:id
// @access  Private (Admin, Location Admin)
const deleteRecipe = asyncHandler(async (req, res) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) {
    res.status(404);
    throw new Error('Recipe not found');
  }

  // Remove reference from MenuItem
  await MenuItem.findOneAndUpdate(
    { recipeId: recipe._id },
    { $set: { recipeId: null } }
  );

  await recipe.deleteOne();

  res.json({
    success: true,
    message: 'Recipe removed successfully',
  });
});

module.exports = {
  getRecipe,
  upsertRecipe,
  deleteRecipe,
};
