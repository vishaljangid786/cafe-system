const asyncHandler = require('../utils/asyncHandler');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const BranchInventory = require('../models/BranchInventory');
const Ingredient = require('../models/Ingredient');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const TransactionService = require('../services/transactionService');
const { canAccessLocation, scopedLocationId, userLocationIds, clampLimit } = require('../utils/accessControl');

const resolveBranch = (req, res, fromBody) => {
  const branchScoped = ['branch_admin', 'location_admin'].includes(req.user.role);
  let locationId = branchScoped ? req.user.assignedLocation : fromBody;
  if (!locationId) {
    res.status(400);
    throw new Error('A branch (locationId) is required');
  }
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch');
  }
  return locationId;
};

/* ----------------------------- Suppliers ----------------------------- */

// @route   POST /api/suppliers
const createSupplier = asyncHandler(async (req, res) => {
  const { name, phone, email, address, gstin, paymentTerms, locationId } = req.body || {};
  if (!name) {
    res.status(400);
    throw new Error('Supplier name is required');
  }
  // Only a super_admin may create an org-wide (shared, null-location) supplier;
  // everyone else must scope it to a concrete branch they can access.
  let loc = null;
  if (locationId) {
    if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, locationId)) {
      res.status(403);
      throw new Error('You do not have access to this branch');
    }
    loc = locationId;
  } else if (req.user.role !== 'super_admin') {
    loc = req.user.assignedLocation;
    if (!loc) {
      res.status(400);
      throw new Error('A branch is required to add a supplier');
    }
  }
  const supplier = await Supplier.create({
    name, phone, email, address, gstin, paymentTerms, locationId: loc, createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: supplier });
});

// @route   GET /api/suppliers
const getSuppliers = asyncHandler(async (req, res) => {
  const branchScoped = ['branch_admin', 'location_admin'].includes(req.user.role);
  // Shared (null) suppliers are always visible; branch suppliers only for accessible branches.
  const branchIds = branchScoped
    ? [req.user.assignedLocation].filter(Boolean)
    : (req.user.role === 'super_admin' ? null : userLocationIds(req.user));
  const filter = { isActive: true };
  filter.$or = [{ locationId: null }];
  if (branchIds === null) {
    delete filter.$or; // super_admin: everything
  } else {
    filter.$or.push({ locationId: { $in: branchIds } });
  }
  const suppliers = await Supplier.find(filter).sort({ name: 1 }).limit(clampLimit(req.query.limit, 200, 500));
  res.json({ success: true, data: suppliers });
});

// @route   PUT /api/suppliers/:id
const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) {
    res.status(404);
    throw new Error('Supplier not found');
  }
  if (!supplier.locationId) {
    // Shared / org-wide (null-location) supplier — only a super_admin may modify it.
    // Previously the guard was skipped entirely for null-location suppliers, so any
    // branch admin could rename or deactivate a supplier used by every branch.
    if (req.user.role !== 'super_admin') {
      res.status(403);
      throw new Error('Only a super admin can modify a shared supplier');
    }
  } else if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, supplier.locationId)) {
    res.status(403);
    throw new Error('You do not have access to this supplier');
  }
  const fields = ['name', 'phone', 'email', 'address', 'gstin', 'paymentTerms', 'isActive'];
  for (const f of fields) if (req.body[f] !== undefined) supplier[f] = req.body[f];
  await supplier.save();
  res.json({ success: true, data: supplier });
});

/* -------------------------- Purchase Orders -------------------------- */

const computeItems = (items = []) =>
  items
    .filter((i) => i && i.name && Number(i.quantity) > 0)
    .map((i) => {
      const quantity = Number(i.quantity) || 0;
      const unitCost = Number(i.unitCost) || 0;
      return {
        ingredient: i.ingredient || null,
        name: i.name.toString(),
        unit: i.unit || 'unit',
        quantity,
        unitCost,
        lineTotal: Number((quantity * unitCost).toFixed(2)),
      };
    });

// @route   POST /api/purchase-orders
const createPurchaseOrder = asyncHandler(async (req, res) => {
  const { supplier, locationId, items, notes } = req.body || {};
  const branch = resolveBranch(req, res, locationId);

  const sup = await Supplier.findById(supplier);
  if (!sup) {
    res.status(400);
    throw new Error('Valid supplier is required');
  }
  if (!sup.isActive) {
    res.status(400);
    throw new Error('This supplier is inactive');
  }
  // A branch-specific supplier may only be used for its own branch; shared
  // (null-location) suppliers are usable anywhere.
  if (sup.locationId && sup.locationId.toString() !== branch.toString()) {
    res.status(403);
    throw new Error('This supplier belongs to another branch');
  }
  const lines = computeItems(items);
  if (lines.length === 0) {
    res.status(400);
    throw new Error('At least one valid item is required');
  }
  const totalAmount = Number(lines.reduce((a, l) => a + l.lineTotal, 0).toFixed(2));

  const po = await PurchaseOrder.create({
    supplier: sup._id,
    locationId: branch,
    items: lines,
    totalAmount,
    notes: (notes || '').toString().slice(0, 1000),
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: po });
});

// @route   GET /api/purchase-orders
const getPurchaseOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const scope = scopedLocationId(req, req.query.locationId);
  if (scope) filter.locationId = scope;

  const pos = await PurchaseOrder.find(filter)
    .populate('supplier', 'name')
    .populate('createdBy', 'name deletedAt')
    .populate('locationId', 'name')
    .sort({ createdAt: -1 })
    .limit(clampLimit(req.query.limit, 50, 200));
  res.json({ success: true, data: pos });
});

// @route   PATCH /api/purchase-orders/:id/receive
// Adds stock to branch inventory and records a single purchase Expense (COGS).
const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const existing = await PurchaseOrder.findById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error('Purchase order not found');
  }
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, existing.locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch');
  }

  // Atomically claim the receive: only the request that flips ordered->received
  // proceeds, so concurrent receives can't double-add stock or double-record the
  // purchase expense.
  const po = await PurchaseOrder.findOneAndUpdate(
    { _id: req.params.id, status: 'ordered' },
    { $set: { status: 'received', receivedBy: req.user._id, receivedAt: new Date() } },
    { new: true }
  ).populate('supplier', 'name');
  if (!po) {
    res.status(400);
    throw new Error(`This order is already ${existing.status}`);
  }

  // The status flip above is the atomic gate (prevents concurrent double-receive).
  // The remaining side effects aren't a DB transaction, so on ANY failure we
  // COMPENSATE — reverse applied stock, delete the created expense/ledger entry,
  // and revert the PO to 'ordered' — so a failed receive fully rolls back and can
  // be safely retried (no half-applied stock or orphaned COGS).
  const appliedStock = []; // { item, before } — `before` captures prior cost basis
  let createdExpense = null;
  try {
    for (const item of po.items) {
      if (!item.ingredient) continue;
      // Capture prior cost basis so a rollback can restore it (the $inc below also
      // overwrites costPerUnit/lastRestocked on an existing doc).
      const before = await BranchInventory.findOne(
        { ingredient: item.ingredient, branch: po.locationId }
      ).select('costPerUnit lastRestocked');
      await BranchInventory.findOneAndUpdate(
        { ingredient: item.ingredient, branch: po.locationId },
        { $inc: { stock: item.quantity }, $set: { costPerUnit: item.unitCost, lastRestocked: new Date() } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      appliedStock.push({ item, before });
    }

    // One purchase expense for the PO total, synced to the revenue/P&L ledger.
    if (po.totalAmount > 0) {
      createdExpense = await Expense.create({
        title: `Purchase order — ${po.supplier?.name || 'supplier'}`,
        description: `PO received: ${po.items.length} item(s) from ${po.supplier?.name || 'supplier'}`,
        amount: po.totalAmount,
        type: 'EXPENSE',
        category: 'Inventory',
        status: 'approved',
        date: new Date(),
        locationId: po.locationId,
        createdBy: req.user._id,
        proofImage: 'po-auto',
      });
      await TransactionService.syncExpenseToTransaction(createdExpense);
      po.expenseId = createdExpense._id;
      await po.save(); // persist the ledger link (status already set by the atomic claim)
    }
  } catch (err) {
    // Revert the status FIRST so the PO is retryable even if later cleanup writes
    // fail (otherwise it could get stuck appearing 'received' with no stock/COGS).
    await PurchaseOrder.updateOne(
      { _id: po._id },
      { $set: { status: 'ordered' }, $unset: { receivedBy: '', receivedAt: '', expenseId: '' } }
    ).catch(() => {});
    // Reverse stock AND restore the prior cost basis (the $inc overwrote it).
    for (const { item, before } of appliedStock) {
      const restore = before
        ? { $inc: { stock: -item.quantity }, $set: { costPerUnit: before.costPerUnit, lastRestocked: before.lastRestocked } }
        : { $inc: { stock: -item.quantity } };
      await BranchInventory.updateOne({ ingredient: item.ingredient, branch: po.locationId }, restore).catch(() => {});
    }
    if (createdExpense) {
      await Transaction.deleteOne({ expenseId: createdExpense._id }).catch(() => {});
      await Expense.deleteOne({ _id: createdExpense._id }).catch(() => {});
    }
    throw err;
  }

  res.json({ success: true, data: po });
});

// @route   PATCH /api/purchase-orders/:id/cancel
const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) {
    res.status(404);
    throw new Error('Purchase order not found');
  }
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, po.locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch');
  }
  if (po.status !== 'ordered') {
    res.status(400);
    throw new Error(`Only an open order can be cancelled (this is ${po.status})`);
  }
  po.status = 'cancelled';
  await po.save();
  res.json({ success: true, data: po });
});

module.exports = {
  createSupplier, getSuppliers, updateSupplier,
  createPurchaseOrder, getPurchaseOrders, receivePurchaseOrder, cancelPurchaseOrder,
};
