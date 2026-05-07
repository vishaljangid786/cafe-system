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
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Admin only routes
router.get('/', authorizeRoles('admin', 'super_admin'), getAllInventory);
router.post('/ingredients', authorizeRoles('admin', 'super_admin'), createIngredient);
router.get('/ingredients', authorizeRoles('admin', 'super_admin'), getIngredients);

// Shared/Branch Admin routes
router.get('/branch/:branchId', authorizeRoles('admin', 'super_admin', 'branch_admin'), getBranchInventory);
router.post('/update', authorizeRoles('admin', 'super_admin', 'branch_admin'), updateInventory);
router.post('/waste', authorizeRoles('admin', 'super_admin', 'branch_admin'), logWaste);
router.get('/alerts', authorizeRoles('admin', 'super_admin', 'branch_admin'), getInventoryAlerts);
router.get('/suggestions', authorizeRoles('admin', 'super_admin', 'branch_admin'), getPurchaseSuggestions);

module.exports = router;
