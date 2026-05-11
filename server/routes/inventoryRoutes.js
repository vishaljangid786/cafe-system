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
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Admin only routes
router.get('/', checkRoles('admin', 'super_admin'), getAllInventory);
router.post('/ingredients', checkRoles('admin', 'super_admin'), createIngredient);
router.get('/ingredients', checkRoles('admin', 'super_admin'), getIngredients);

// Shared/Branch Admin routes
router.get('/branch/:branchId', checkRoles('admin', 'super_admin', 'branch_admin'), getBranchInventory);
router.post('/update', checkRoles('admin', 'super_admin', 'branch_admin'), updateInventory);
router.post('/waste', checkRoles('admin', 'super_admin', 'branch_admin'), logWaste);
router.get('/alerts', checkRoles('admin', 'super_admin', 'branch_admin'), getInventoryAlerts);
router.get('/suggestions', checkRoles('admin', 'super_admin', 'branch_admin'), getPurchaseSuggestions);

module.exports = router;
