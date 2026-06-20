const mongoose = require('mongoose');
const Ingredient = require('../models/Ingredient');
const BranchInventory = require('../models/BranchInventory');
const WasteRecord = require('../models/WasteRecord');
const Recipe = require('../models/Recipe');
const BranchStock = require('../models/BranchStock');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const { enforceLocationAccess, scopedLocationId, userLocationIds } = require('../utils/accessControl');
// Re-export from service layer — single source of truth, no duplicate logic
const { deductIngredientsFromRecipe } = require('../services/inventoryService');

// @desc    Get inventory for a specific branch
// @route   GET /api/inventory/branch/:branchId
const getBranchInventory = asyncHandler(async (req, res) => {
  const { branchId } = req.params;

  // Authorization check
  enforceLocationAccess(req, res, branchId, 'You do not have permission to view this branch inventory');

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
  enforceLocationAccess(req, res, branch, 'You do not have permission to update this branch inventory');

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
  enforceLocationAccess(req, res, branch, 'You do not have permission to log waste for this branch');

  if (Number(quantity) <= 0) {
    res.status(400);
    throw new Error('Quantity must be greater than zero');
  }

  const updated = await BranchInventory.findOneAndUpdate(
    { branch, ingredient, stock: { $gte: Number(quantity) } },
    { $inc: { stock: -Number(quantity) } },
    { new: true }
  );

  if (!updated) {
    res.status(400);
    throw new Error('Insufficient inventory stock to log this waste quantity');
  }

  const waste = await WasteRecord.create({
    branch,
    ingredient,
    quantity,
    reason,
    notes,
    recordedBy: req.user._id,
  });

  res.json({ success: true, data: waste });
});

// @desc    Get low stock alerts across all branches (Admin) or single branch
// @route   GET /api/inventory/alerts
const getInventoryAlerts = asyncHandler(async (req, res) => {
  const { branchId } = req.query;
  const scopedBranch = scopedLocationId(req, branchId);

  const query = { $expr: { $lte: ['$stock', '$minThreshold'] } };
  if (scopedBranch) {
    query.branch = typeof scopedBranch === 'object'
      ? scopedBranch
      : new mongoose.Types.ObjectId(scopedBranch);
  }

  const alerts = await BranchInventory.find(query)
    .populate('ingredient')
    .populate('branch', 'name')
    .lean();

  res.json({ success: true, count: alerts.length, data: alerts });
});

// @desc    Get Purchase Suggestions
// @route   GET /api/inventory/suggestions
const getPurchaseSuggestions = asyncHandler(async (req, res) => {
  const { branchId } = req.query;
  const scopedBranch = scopedLocationId(req, branchId);

  const query = {};
  if (scopedBranch) query.branch = scopedBranch;

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
  const { scopedLocationId } = require('../utils/accessControl');
  const query = {};

  // Standard RBAC Enforcement
  const branch = scopedLocationId(req, branchId);
  if (branch) query.branch = branch;
  
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
  getAllInventory,
  // Re-exported from inventoryService — single source of truth
  deductIngredientsFromRecipe
};

