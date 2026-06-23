const Recipe = require('../models/Recipe');
const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');
const { canAccessLocation } = require('../utils/accessControl');

// A menu item is reachable by a non-super actor only if it is global, or it
// belongs to (locationId / one of availableBranches) a branch the actor manages.
const canAccessMenuItem = (user, item) => {
  if (!item) return false;
  if (user.role === 'super_admin') return true;
  if (item.isGlobal) return true;
  if (item.locationId && canAccessLocation(user, item.locationId)) return true;
  if (Array.isArray(item.availableBranches)
    && item.availableBranches.some((b) => canAccessLocation(user, b))) return true;
  return false;
};

const ensureMenuItemAccess = (req, res, item) => {
  if (!canAccessMenuItem(req.user, item)) {
    res.status(403);
    throw new Error('You do not have permission to manage recipes for this menu item');
  }
};

// @desc    Get recipe for a menu item
// @route   GET /api/recipes/:menuItemId
// @access  Private
const getRecipe = asyncHandler(async (req, res) => {
  const recipe = await Recipe.findOne({ menuItemId: req.params.menuItemId });

  if (!recipe) {
    res.status(404);
    throw new Error('Recipe not found for this item');
  }

  // Branch-scope reads: a non-super actor may only read recipes for menu items
  // belonging to a branch they manage (or global items).
  const item = await MenuItem.findById(recipe.menuItemId);
  ensureMenuItemAccess(req, res, item);

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
  ensureMenuItemAccess(req, res, item);

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

  // Branch-scope deletes to the owning menu item's branch (or global).
  const item = await MenuItem.findById(recipe.menuItemId);
  ensureMenuItemAccess(req, res, item);

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
