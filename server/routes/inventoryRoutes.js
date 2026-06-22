const express = require('express');
const router = express.Router();
const {
  getBranchInventory,
  updateInventory,
  logWaste,
  getInventoryAlerts,
  getPurchaseSuggestions,
  createIngredient,
  getIngredients,
  getAllInventory
} = require('../controllers/inventoryController');
const { verifyToken, checkRoles, checkRoleOrPermission } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Reads are branch-scoped in the controller (scopedLocationId), so any manageOrders
// holder / branch admin may view their own inventory — not just admins. Creating
// ingredient definitions (catalog) stays admin-only.
router.get('/', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getAllInventory);
router.post('/ingredients', checkRoles('admin', 'super_admin'), createIngredient);
router.get('/ingredients', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getIngredients);

// Shared/Branch routes — reads match the list route (any manageOrders holder).
router.get('/branch/:branchId', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getBranchInventory);
router.post('/update', checkRoles('admin', 'super_admin', 'branch_admin'), updateInventory);
router.post('/waste', checkRoles('admin', 'super_admin', 'branch_admin'), logWaste);
router.get('/alerts', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getInventoryAlerts);
router.get('/suggestions', checkRoleOrPermission(['admin', 'super_admin', 'branch_admin'], 'manageOrders'), getPurchaseSuggestions);

module.exports = router;
