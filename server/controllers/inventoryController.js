const Ingredient = require('../models/Ingredient');
const BranchInventory = require('../models/BranchInventory');
const WasteRecord = require('../models/WasteRecord');
const Recipe = require('../models/Recipe');
const BranchStock = require('../models/BranchStock');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const { enforceLocationAccess } = require('../utils/accessControl');

// @desc    Get inventory for a specific branch
// @route   GET /api/inventory/branch/:branchId
const getBranchInventory = asyncHandler(async (req, res) => {
  const { branchId } = req.params;

  // Authorization check
  enforceLocationAccess(req, res, branchId, 'You are not authorized to view this branch inventory');

  const inventory = await BranchInventory.find({ branch: branchId })
    .populate('ingredient')
    .lean();
  
  res.json({ success: true, data: inventory });
});

// @desc    Update/Restock inventory
// @route   POST /api/inventory/update
const updateInventory = asyncHandler(async (req, res) => {
  const { branch, ingredient, quantity, costPerUnit, minThreshold } = req.body;

  // Authorization check
  enforceLocationAccess(req, res, branch, 'You are not authorized to update this branch inventory');

  if (Number(quantity) <= 0) {
    res.status(400);
    throw new Error('Quantity must be greater than zero');
  }

  let item = await BranchInventory.findOne({ branch, ingredient });

  if (item) {
    item.stock += Number(quantity);
    if (costPerUnit) item.costPerUnit = costPerUnit;
    if (minThreshold) item.minThreshold = minThreshold;
    item.lastRestocked = new Date();
    await item.save();
  } else {
    item = await BranchInventory.create({
      branch,
      ingredient,
      stock: quantity,
      costPerUnit,
      minThreshold: minThreshold || 10,
    });
  }

  res.json({ success: true, data: item });
});

// @desc    Log waste
// @route   POST /api/inventory/waste
const logWaste = asyncHandler(async (req, res) => {
  const { branch, ingredient, quantity, reason, notes } = req.body;

  // Authorization check
  enforceLocationAccess(req, res, branch, 'You are not authorized to log waste for this branch');

  if (Number(quantity) <= 0) {
    res.status(400);
    throw new Error('Quantity must be greater than zero');
  }

  const waste = await WasteRecord.create({
    branch,
    ingredient,
    quantity,
    reason,
    notes,
    recordedBy: req.user._id,
  });

  // Deduct from inventory
  await BranchInventory.findOneAndUpdate(
    { branch, ingredient },
    { $inc: { stock: -Number(quantity) } }
  );

  res.json({ success: true, data: waste });
});

// @desc    Get low stock alerts across all branches (Admin) or single branch
// @route   GET /api/inventory/alerts
const getInventoryAlerts = asyncHandler(async (req, res) => {
  let { branchId } = req.query;
  
  // Authorization check for branch_admin
  if (req.user.role === 'branch_admin') {
    branchId = req.user.assignedLocation.toString();
  } else if (branchId) {
    enforceLocationAccess(req, res, branchId, 'You are not authorized to view this branch inventory');
  }

  const query = {};
  if (branchId) query.branch = branchId;

  const alerts = await BranchInventory.find(query)
    .populate('ingredient')
    .populate('branch', 'name')
    .lean();

  const filteredAlerts = alerts.filter(item => item.stock <= item.minThreshold);

  res.json({ success: true, count: filteredAlerts.length, data: filteredAlerts });
});

// @desc    Get Purchase Suggestions
// @route   GET /api/inventory/suggestions
const getPurchaseSuggestions = asyncHandler(async (req, res) => {
  let { branchId } = req.query;

  // Authorization check for branch_admin
  if (req.user.role === 'branch_admin') {
    branchId = req.user.assignedLocation.toString();
  } else if (branchId) {
    enforceLocationAccess(req, res, branchId, 'You are not authorized to view this branch inventory');
  }

  const query = {};
  if (branchId) query.branch = branchId;

  const suggestions = await BranchInventory.find(query)
    .populate('ingredient')
    .lean();

  const data = suggestions
    .filter(item => item.stock <= item.minThreshold)
    .map(item => ({
      ingredient: item.ingredient.name,
      currentStock: item.stock,
      threshold: item.minThreshold,
      suggestedOrder: Math.max(item.minThreshold * 2 - item.stock, 10),
      unit: item.ingredient.unit
    }));

  res.json({ success: true, data });
});

// @desc    Manage Global Ingredients (CRUD)
const createIngredient = asyncHandler(async (req, res) => {
  const ingredient = await Ingredient.create(req.body);
  res.status(201).json({ success: true, data: ingredient });
});

const getIngredients = asyncHandler(async (req, res) => {
  const ingredients = await Ingredient.find().lean();
  res.json({ success: true, data: ingredients });
});

// @desc    Get all inventory items (across all branches)
// @route   GET /api/inventory
const getAllInventory = asyncHandler(async (req, res) => {
  const { isActive, branchId } = req.query;
  const query = {};

  // RBAC Enforcement
  if (req.user.role === 'super_admin') {
    if (branchId && branchId !== 'all') query.branch = branchId;
  } else if (req.user.role === 'admin') {
    const allowed = (req.user.accessibleLocations || []).map(id => id.toString());
    if (branchId && branchId !== 'all') {
      if (!allowed.includes(branchId)) return res.status(403).json({ success: false, message: 'Access denied' });
      query.branch = branchId;
    } else {
      query.branch = { $in: allowed };
    }
  } else {
    query.branch = req.user.assignedLocation;
  }
  
  const inventory = await BranchInventory.find(query)
    .populate({
      path: 'ingredient',
      match: isActive !== undefined ? { isActive: isActive === 'true' } : {}
    })
    .populate('branch', 'name')
    .lean();

  // Filter out items where the populated ingredient doesn't match the criteria (if any)
  const filteredInventory = inventory.filter(item => item.ingredient !== null);
  
  res.json({ success: true, data: filteredInventory });
});

module.exports = {
  getBranchInventory,
  updateInventory,
  logWaste,
  getInventoryAlerts,
  getPurchaseSuggestions,
  createIngredient,
  getIngredients,
  getAllInventory
};
