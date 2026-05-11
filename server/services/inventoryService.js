/**
 * Inventory Service
 *
 * Shared business logic for inventory operations. Extracted from inventoryController
 * to break the anti-pattern of utils/ importing from controllers/.
 *
 * Previously `orderFinalizer.js` imported `deductIngredientsFromRecipe` directly
 * from `inventoryController.js`, creating a cross-layer coupling risk.
 * All shared inventory logic now lives here.
 */
const Recipe = require('../models/Recipe');
const BranchInventory = require('../models/BranchInventory');

/**
 * Deducts raw ingredient stock for each item in a completed order
 * based on the Recipe blueprint for that menu item.
 * Silently continues if no recipe is found (allows items without recipes).
 *
 * @param {Object} order  - Populated Order document (must have order.items)
 * @param {string} branchId - The branch ObjectId string
 * @returns {Promise<boolean>} - true on success, false on error
 */
const deductIngredientsFromRecipe = async (order, branchId) => {
  try {
    for (const item of order.items) {
      const recipe = await Recipe.findOne({ menuItemId: item.menuItem });
      if (!recipe) continue;

      for (const ingredientInfo of recipe.ingredients) {
        const deductionQuantity = ingredientInfo.quantity * item.quantity;
        await BranchInventory.findOneAndUpdate(
          { branch: branchId, ingredient: ingredientInfo.ingredient },
          { $inc: { stock: -deductionQuantity } }
        );
      }
    }
    return true;
  } catch (error) {
    console.error('[InventoryService] Ingredient deduction failed:', error);
    return false;
  }
};

module.exports = { deductIngredientsFromRecipe };
