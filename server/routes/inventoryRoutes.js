const express = require('express');
const router = express.Router();
const {
  getBranchInventory,
  updateInventory,
  logWaste,
  deleteWaste,
  getInventoryAlerts,
  getPurchaseSuggestions,
  createIngredient,
  getIngredients,
  deleteIngredient,
  getAllInventory
} = require('../controllers/inventoryController');
const { verifyToken, checkRoles, checkRoleOrPermission, checkAction } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Reads are branch-scoped in the controller (scopedLocationId), so any manageOrders
// holder / branch admin may view their own inventory — not just admins. Creating
// ingredient definitions (catalog) stays admin-only (legacy roles still pass).
router.get('/', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getAllInventory);
router.post('/ingredients', checkAction('inventory.add'), createIngredient);
router.get('/ingredients', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getIngredients);
// The ingredient catalog is cafe-wide: checkAction gates the permission, and the
// controller's assertCanDelete additionally applies the global-role check because
// the record has no branch to scope against.
router.delete('/ingredients/:id', checkAction('inventory.delete'), deleteIngredient);

// Shared/Branch routes — reads match the list route (any manageOrders holder).
router.get('/branch/:branchId', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getBranchInventory);
router.post('/update', checkAction('inventory.modify'), updateInventory);
router.post('/waste', checkAction('inventory.modify'), logWaste);
// Branch scope for a waste record can only be decided once the id is resolved, so
// the controller re-checks with assertCanDelete on top of this middleware.
router.delete('/waste/:id', checkAction('inventory.delete'), deleteWaste);
router.get('/alerts', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getInventoryAlerts);
router.get('/suggestions', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getPurchaseSuggestions);

module.exports = router;
