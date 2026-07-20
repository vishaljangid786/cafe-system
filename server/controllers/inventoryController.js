const mongoose = require('mongoose');
const Ingredient = require('../models/Ingredient');
const BranchInventory = require('../models/BranchInventory');
const WasteRecord = require('../models/WasteRecord');
const Recipe = require('../models/Recipe');
const BranchStock = require('../models/BranchStock');
const Expense = require('../models/Expense');
const TransactionService = require('../services/transactionService');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const { enforceLocationAccess, scopedLocationId, userLocationIds } = require('../utils/accessControl');
const sendNotification = require('../utils/sendNotification');
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

  if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
    res.status(400);
    throw new Error('Quantity must be a number greater than zero');
  }

  if (costPerUnit !== undefined && (!Number.isFinite(Number(costPerUnit)) || Number(costPerUnit) < 0)) {
    res.status(400);
    throw new Error('Cost per unit must be a number of 0 or more');
  }

  if (minThreshold !== undefined && (!Number.isFinite(Number(minThreshold)) || Number(minThreshold) < 0)) {
    res.status(400);
    throw new Error('Minimum threshold must be a number of 0 or more');
  }

  // Atomic upsert with $inc so this restock MERGES with any concurrent atomic
  // deduction (order completion / waste log) instead of clobbering it via a
  // read-modify-write, and two first-time restocks can't race the create.
  const update = {
    $inc: { stock: Number(quantity) },
    $set: { lastRestocked: new Date() },
  };
  if (costPerUnit !== undefined) update.$set.costPerUnit = Number(costPerUnit);
  if (minThreshold !== undefined) update.$set.minThreshold = Number(minThreshold);
  else update.$setOnInsert = { minThreshold: 10 };

  const item = await BranchInventory.findOneAndUpdate(
    { branch, ingredient },
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // Effective unit cost for this purchase (the provided value, else the row's
  // existing recorded cost — both reflected in the returned document). Used to
  // book the purchase expense.
  const effectiveCost = Number(item.costPerUnit || 0);

  // Book the restock as a real purchase expense in the ledger so COGS shows in
  // P&L (previously inventory purchases were invisible, overstating profit).
  const purchaseCost = Number(quantity) * effectiveCost;
  if (purchaseCost > 0) {
    const ing = await Ingredient.findById(ingredient).select('name unit');
    const expense = await Expense.create({
      title: `Inventory purchase — ${ing?.name || 'ingredient'}`,
      description: `Restocked ${quantity} ${ing?.unit || 'units'} of ${ing?.name || 'ingredient'} @ ₹${effectiveCost}/unit`,
      amount: purchaseCost,
      type: 'EXPENSE',
      category: 'Inventory',
      status: 'approved',
      date: new Date(),
      locationId: branch,
      createdBy: req.user._id,
      proofImage: 'inventory-auto',
    });
    await TransactionService.syncExpenseToTransaction(expense);
  }

  await sendNotification({
    title: 'Inventory Restocked',
    message: `Inventory was restocked by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: branch,
  });

  res.json({ success: true, data: item });
});

// @desc    Log waste
// @route   POST /api/inventory/waste
const logWaste = asyncHandler(async (req, res) => {
  const { branch, ingredient, quantity, reason, notes } = req.body;

  // Authorization check
  enforceLocationAccess(req, res, branch, 'You do not have permission to log waste for this branch');

  if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
    res.status(400);
    throw new Error('Quantity must be a number greater than zero');
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

  await sendNotification({
    title: 'Waste Logged',
    message: `Inventory waste was logged by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: branch,
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
    .filter(item => item.ingredient && item.stock <= item.minThreshold)
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
  const { name, unit, category, baseCost, isActive } = req.body;

  const data = { name, unit };
  if (category !== undefined) data.category = category;
  if (baseCost !== undefined) data.baseCost = Number(baseCost);
  if (isActive !== undefined) {
    data.isActive = isActive === 'on' || isActive === 'true' || isActive === true;
  }

  const ingredient = await Ingredient.create(data);

  await sendNotification({
    title: 'Ingredient Created',
    message: `Ingredient ${ingredient.name} was created by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
  });

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

