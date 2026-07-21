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
const { requireRecord, assertCanDelete, announceDeletion } = require('../utils/deleteGuard');
const sendNotification = require('../utils/sendNotification');
// Re-export from service layer — single source of truth, no duplicate logic
const { deductIngredientsFromRecipe } = require('../services/inventoryService');

// A malformed id would otherwise reach Mongoose and come back through the error
// middleware as a bare "Resource not found" — which tells the operator nothing.
// Checking it here keeps every failure in this file specific and actionable.
const requireValidId = (res, id, resource) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error(`"${id}" is not a valid ${resource} id. Refresh the page and try again from the list.`);
  }
  return id;
};

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

// @desc    Delete a logged waste record (and put the wasted quantity back)
// @route   DELETE /api/inventory/waste/:id
const deleteWaste = asyncHandler(async (req, res) => {
  requireValidId(res, req.params.id, 'waste record');

  // Populate so every message can name the ingredient and the branch —
  // normalizeId() inside the guards unwraps a populated ref, so branch scoping
  // still works on the populated document.
  const waste = await WasteRecord.findById(req.params.id)
    .populate('ingredient', 'name unit')
    .populate('branch', 'name');
  requireRecord(res, waste, 'Waste record');

  const locationId = waste.branch?._id || waste.branch;
  const branchName = waste.branch?.name || 'this branch';
  const ingredientId = waste.ingredient?._id || waste.ingredient;
  const ingredientName = waste.ingredient?.name || 'ingredient';
  const unit = waste.ingredient?.unit || 'units';
  const quantity = Number(waste.quantity) || 0;
  const loggedAt = new Date(waste.date || waste.createdAt);

  assertCanDelete(req, res, {
    resource: 'waste record',
    actionKey: 'inventory.delete',
    // Waste always belongs to exactly one branch, so this is a pure branch-scope
    // check: a branch admin may clean up their own branch's mis-logged waste only.
    locationId,
  });

  // GUARD — a waste entry is a loss record. analyticsController reads it for
  // wastage reporting and for the per-staff activity report, so once the day it
  // belongs to has been reported on, erasing it quietly improves someone's
  // numbers with no reversal trail. Inside 24 hours it is still a typo being
  // fixed; after that a super admin must decide.
  const ageHours = (Date.now() - loggedAt.getTime()) / 36e5;
  if (ageHours > 24 && req.user.role !== 'super_admin') {
    res.status(400);
    throw new Error(
      `This waste entry (${quantity} ${unit} of ${ingredientName} at ${branchName}, logged ${loggedAt.toDateString()}) is older than 24 hours and has already been counted in the wastage and staff activity reports for that period. Correct the shelf count with a restock in Update Inventory instead of erasing the loss — only a super admin can delete a settled waste record.`
    );
  }

  await waste.deleteOne();

  // CASCADE — REVERSED ON PURPOSE: logWaste is what deducted this quantity from
  // BranchInventory, and this record is the ONLY document explaining that
  // deduction. Removing it without adding the stock back would leave the shelf
  // count permanently short with nothing to account for the gap, so the deduction
  // is undone here. No upsert: if the branch no longer carries the ingredient at
  // all, re-creating a stock row for it would invent inventory nobody stocks.
  const restored = quantity > 0 && ingredientId
    ? await BranchInventory.findOneAndUpdate(
        { branch: locationId, ingredient: ingredientId },
        { $inc: { stock: quantity } },
        { new: true }
      )
    : null;

  const stockNote = restored
    ? `${quantity} ${unit} of ${ingredientName} went back into ${branchName} stock (now ${restored.stock}).`
    : `${branchName} no longer carries ${ingredientName}, so no stock was added back.`;

  await announceDeletion(req, {
    resource: 'Waste Record',
    name: `${quantity} ${unit} of ${ingredientName}`,
    locationId,
    action: 'WASTE_RECORD_DELETE',
    // The person who logged the waste is usually floor staff, not a manager, so
    // the manager fan-out would never reach them — and it was their entry.
    notifyUserIds: [waste.recordedBy?.toString()].filter(Boolean),
    detail: `It was logged on ${loggedAt.toDateString()} as "${waste.reason}". ${stockNote}`,
    metadata: {
      wasteRecordId: String(waste._id),
      ingredient: ingredientName,
      quantity,
      unit,
      reason: waste.reason,
      stockRestored: Boolean(restored),
      loggedAt: loggedAt.toISOString(),
    },
  });

  res.json({ success: true, message: `Waste record removed. ${stockNote}` });
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

// @desc    Delete a global ingredient definition and its per-branch stock rows
// @route   DELETE /api/inventory/ingredients/:id
const deleteIngredient = asyncHandler(async (req, res) => {
  requireValidId(res, req.params.id, 'ingredient');

  const ingredient = await Ingredient.findById(req.params.id);
  requireRecord(res, ingredient, 'Ingredient');

  // Ingredient is the CAFE-WIDE catalog — the schema has no branch at all. Passing
  // no locationId makes assertCanDelete fall through to the global-role check, so a
  // branch admin holding inventory.delete can still clean up their own branch's
  // waste but cannot delete a definition every other branch stocks.
  assertCanDelete(req, res, {
    resource: 'ingredient',
    actionKey: 'inventory.delete',
  });

  // GUARD 1 — recipes. Refused for EVERY role including super_admin: this is
  // referential integrity, not a money rule a superior may knowingly override.
  // Recipe lines carry BOTH an optional `ingredient` ref and a required `name`
  // snapshot, so a recipe authored before the catalog existed links by name only —
  // counting the ref alone would let us delete something half the menu depends on
  // and deductIngredientsFromRecipe would silently stop deducting stock for it.
  const nameRegex = new RegExp(`^${ingredient.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  const recipeFilter = {
    $or: [
      { 'ingredients.ingredient': ingredient._id },
      // `ingredient: null` also matches lines where the field is absent.
      { ingredients: { $elemMatch: { ingredient: null, name: nameRegex } } },
    ],
  };
  const [recipeCount, sampleRecipes] = await Promise.all([
    Recipe.countDocuments(recipeFilter),
    Recipe.find(recipeFilter).populate('menuItemId', 'name').select('menuItemId').limit(3).lean(),
  ]);
  if (recipeCount > 0) {
    const names = sampleRecipes.map((r) => r.menuItemId?.name).filter(Boolean);
    res.status(400);
    throw new Error(
      `"${ingredient.name}" is still used by ${recipeCount} recipe(s)${names.length ? ` — including ${names.join(', ')}` : ''}. Remove it from those recipes first, or leave them alone and simply mark the ingredient inactive, which hides it from new stock entry while keeping the recipes costing correctly.`
    );
  }

  // GUARD 2 — stock still on the shelf. Every unit of it was paid for and booked
  // as a purchase expense by updateInventory, so deleting the rows writes off real
  // value with nothing to reconcile against. The safe alternative is to consume or
  // waste it down to zero (which leaves a trail) or to deactivate the ingredient.
  // A super admin may still force it — sometimes the row itself is the mistake.
  const stockRows = await BranchInventory.find({ ingredient: ingredient._id })
    .populate('branch', 'name')
    .lean();
  const withStock = stockRows.filter((r) => Number(r.stock) > 0);
  if (withStock.length > 0 && req.user.role !== 'super_admin') {
    const breakdown = withStock
      .map((r) => `${r.branch?.name || 'unknown branch'} ${r.stock} ${ingredient.unit}`)
      .join(', ');
    res.status(400);
    throw new Error(
      `"${ingredient.name}" still has stock on hand at ${withStock.length} branch(es): ${breakdown}. Log it as waste or use it up so the count reaches zero before deleting, or mark the ingredient inactive to retire it while keeping the stock figures honest. Only a super admin can delete an ingredient that still has stock.`
    );
  }

  // GUARD 3 — waste history. WasteRecord.ingredient is a required ref that the
  // staff activity report populates by name, so removing the ingredient turns
  // every past loss into an unnamed row. Deactivating keeps that history readable.
  const wasteCount = await WasteRecord.countDocuments({ ingredient: ingredient._id });
  if (wasteCount > 0 && req.user.role !== 'super_admin') {
    res.status(400);
    throw new Error(
      `"${ingredient.name}" appears in ${wasteCount} waste record(s), and those loss entries would lose their ingredient name if it were deleted. Mark the ingredient inactive instead — it disappears from restock and recipe pickers while the wastage reports keep reading correctly. Only a super admin can delete an ingredient with waste history.`
    );
  }

  const ingredientName = ingredient.name;
  await ingredient.deleteOne();

  // CASCADE 1 — CLEANED UP: a BranchInventory row is a per-branch stock count for
  // this exact ingredient and means nothing without it (getAllInventory already
  // has to filter out rows whose populated ingredient came back null). They go too.
  const { deletedCount = 0 } = await BranchInventory.deleteMany({ ingredient: ingredient._id });

  // CASCADE 2 — DELIBERATELY PRESERVED: WasteRecord rows survive, matching the
  // 'preserve' disposition the cascade registry (services/dependencyGraph.js) uses
  // for financial and audit history — a recorded loss must keep reconciling after
  // the catalog entry is gone. Only a super admin ever reaches this line with any
  // (guard 3), and the notification below states how many were left behind.
  //
  // CASCADE 3 — DELIBERATELY UNTOUCHED: the purchase Expense rows updateInventory
  // books on restock name the ingredient in free text only, with no ref, so they
  // are already immune — and they are ledger records that must never be erased by
  // a catalog cleanup.

  await announceDeletion(req, {
    resource: 'Ingredient',
    name: ingredientName,
    // No locationId: an ingredient is cafe-wide, so this fans out to the org
    // administrators rather than to one branch's managers.
    action: 'INGREDIENT_DELETE',
    detail: `${deletedCount} branch stock row(s) were removed with it.${wasteCount > 0 ? ` ${wasteCount} waste record(s) were kept and now reference a deleted ingredient.` : ''}`,
    metadata: {
      ingredientId: String(ingredient._id),
      unit: ingredient.unit,
      category: ingredient.category,
      wasActive: ingredient.isActive,
      branchStockRowsRemoved: deletedCount,
      wasteRecordsPreserved: wasteCount,
    },
  });

  res.json({
    success: true,
    message: `Ingredient removed along with ${deletedCount} branch stock row(s)`,
    data: { branchStockRowsRemoved: deletedCount, wasteRecordsPreserved: wasteCount },
  });
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
  deleteWaste,
  getInventoryAlerts,
  getPurchaseSuggestions,
  createIngredient,
  getIngredients,
  deleteIngredient,
  getAllInventory,
  // Re-exported from inventoryService — single source of truth
  deductIngredientsFromRecipe
};

