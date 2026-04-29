const Ingredient = require('../models/Ingredient');
const BranchInventory = require('../models/BranchInventory');
const WasteRecord = require('../models/WasteRecord');
const Recipe = require('../models/Recipe');
const BranchStock = require('../models/BranchStock');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');

// @desc    Get inventory for a specific branch
// @route   GET /api/inventory/branch/:branchId
const getBranchInventory = asyncHandler(async (req, res) => {
  const inventory = await BranchInventory.find({ branch: req.params.branchId })
    .populate('ingredient')
    .lean();
  
  res.json({ success: true, data: inventory });
});

// @desc    Update/Restock inventory
// @route   POST /api/inventory/update
const updateInventory = asyncHandler(async (req, res) => {
  const { branch, ingredient, quantity, costPerUnit, minThreshold } = req.body;

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
  const { branchId } = req.query;
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
  const { branchId } = req.query;
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

module.exports = {
  getBranchInventory,
  updateInventory,
  logWaste,
  getInventoryAlerts,
  getPurchaseSuggestions,
  createIngredient,
  getIngredients
};
