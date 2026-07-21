const asyncHandler = require('../utils/asyncHandler');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const BranchInventory = require('../models/BranchInventory');
const Ingredient = require('../models/Ingredient');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const TransactionService = require('../services/transactionService');
const { canAccessLocation, scopedLocationId, userLocationIds, clampLimit } = require('../utils/accessControl');
const { requireRecord, assertCanDelete, announceDeletion } = require('../utils/deleteGuard');

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

// @desc    Delete a supplier
// @route   DELETE /api/suppliers/:id
const deleteSupplier = asyncHandler(async (req, res) => {
  // Populate the branch so the messages can name it — normalizeId() inside the
  // guards unwraps a populated ref, so scoping still works on the populated doc.
  const supplier = await Supplier.findById(req.params.id).populate('locationId', 'name');
  requireRecord(res, supplier, 'Supplier');

  const locationId = supplier.locationId?._id || supplier.locationId || null;
  const branchName = supplier.locationId?.name || null;

  assertCanDelete(req, res, {
    resource: 'supplier',
    actionKey: 'procurement.delete',
    // null locationId = a shared, org-wide vendor every branch orders from.
    locationId,
    // updateSupplier already limits merely EDITING a shared supplier to a super
    // admin; deleting one is strictly more destructive, so it must not be looser
    // than editing (the default global roles would also let a plain admin through).
    globalRoles: ['super_admin'],
  });

  // GUARD — refuse while any purchase order still points at this vendor, and refuse
  // it for EVERY role including super_admin: this is referential integrity, not a
  // money rule a superior can knowingly override. PurchaseOrder.supplier is a hard
  // ref with no name snapshot on the order, so removing the vendor silently turns
  // every PO it ever fulfilled — including received ones carrying real COGS — into a
  // row with a blank supplier on the procurement screen and in the ledger drill-down.
  // The caller must clear those orders first (or retire the vendor with isActive).
  const byStatus = await PurchaseOrder.aggregate([
    { $match: { supplier: supplier._id } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const counts = byStatus.reduce((acc, r) => ({ ...acc, [r._id]: r.n }), {});
  const linkedOrders = byStatus.reduce((a, r) => a + r.n, 0);
  if (linkedOrders > 0) {
    res.status(400);
    throw new Error(
      `"${supplier.name}" is still used by ${linkedOrders} purchase order(s) — ${counts.ordered || 0} open, ${counts.received || 0} received, ${counts.cancelled || 0} cancelled. Delete those orders first (cancelling one does NOT release the link), or leave them alone and simply mark this supplier inactive, which hides it from new orders while keeping the purchase history readable.`
    );
  }

  await supplier.deleteOne();

  // CASCADE: nothing to clean up. The zero-orders check above is what makes that
  // true — a supplier with no purchase orders is referenced by nothing else in the
  // schema (ingredients and inventory never link to it).

  await announceDeletion(req, {
    resource: 'Supplier',
    name: supplier.name,
    locationId,
    action: 'SUPPLIER_DELETE',
    // The person who added the vendor is often branch staff, not a manager, so the
    // manager fan-out would never reach them.
    notifyUserIds: [supplier.createdBy?.toString()].filter(Boolean),
    detail: branchName
      ? `It was a ${branchName} supplier and had no purchase orders on record.`
      : 'It was a shared (all-branch) supplier and had no purchase orders on record.',
    metadata: {
      supplierId: String(supplier._id),
      phone: supplier.phone,
      email: supplier.email,
      gstin: supplier.gstin,
      wasActive: supplier.isActive,
      shared: !locationId,
    },
  });

  res.json({ success: true, message: 'Supplier removed' });
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

// @desc    Delete a purchase order
// @route   DELETE /api/purchase-orders/:id
const deletePurchaseOrder = asyncHandler(async (req, res) => {
  // Populate so the error/notification text can name the vendor and branch —
  // normalizeId() inside the guards unwraps the populated branch, so scoping works.
  const po = await PurchaseOrder.findById(req.params.id)
    .populate('supplier', 'name')
    .populate('locationId', 'name');
  requireRecord(res, po, 'Purchase order');

  const locationId = po.locationId?._id || po.locationId;
  const branchName = po.locationId?.name || 'this branch';
  const supplierName = po.supplier?.name || 'supplier';
  const poRef = String(po._id).slice(-6).toUpperCase();

  assertCanDelete(req, res, {
    resource: 'purchase order',
    actionKey: 'procurement.delete',
    locationId,
  });

  // GUARD — a RECEIVED order already moved stock AND money: receivePurchaseOrder
  // added every line to BranchInventory and posted an approved purchase Expense
  // (COGS) to the ledger. Deleting it erases a real cost (overstating profit) and
  // leaves stock on the shelf that no document explains, with no reversal trail —
  // so it stays super_admin-only regardless of the procurement.delete flag. An
  // 'ordered' order has moved nothing yet and its safe alternative is Cancel, which
  // keeps the paper trail; a 'cancelled' order deletes freely.
  if (po.status === 'received' && req.user.role !== 'super_admin') {
    res.status(400);
    throw new Error(
      `Purchase order #${poRef} from ${supplierName} was already received at ${branchName}: its ${po.items.length} item(s) are in stock and ₹${po.totalAmount} is posted to the ledger as a purchase expense. Cancel an order instead of deleting it while it is still open — a received one can only be removed by a super admin, so ask one, or reject the linked purchase expense to reverse the cost.`
    );
  }

  const expenseId = po.expenseId;
  const status = po.status;
  const itemCount = po.items.length;
  const totalAmount = po.totalAmount;
  const createdById = po.createdBy?.toString();
  const receivedById = po.receivedBy?.toString();

  await po.deleteOne();

  // CASCADE 1 — CLEANED UP: the purchase Expense and its ledger Transaction exist
  // only because this PO was received, and the link is one-way (PO -> expenseId;
  // the Expense has no back-reference). Leaving them would strand a COGS line for a
  // purchase that no longer exists, and no screen could ever trace it back to
  // remove it. So they go with the order. Only a super admin ever reaches this
  // branch of the code, per the guard above.
  if (expenseId) {
    await Expense.deleteOne({ _id: expenseId });
    await TransactionService.deleteExpenseTransaction(expenseId);
  }

  // CASCADE 2 — DELIBERATELY NOT REVERSED: stock added on receive stays. The goods
  // physically arrived and have usually been consumed by sales/recipes since, so
  // decrementing now would drive BranchInventory negative and misstate what is
  // actually on the shelf — worse than the orphan it would fix. The correct
  // correction for a wrong quantity is a stock adjustment, so the notification
  // below states plainly that the stock remains.

  await announceDeletion(req, {
    resource: 'Purchase Order',
    name: `#${poRef} — ${supplierName}`,
    locationId,
    action: 'PURCHASE_ORDER_DELETE',
    // The buyer who raised the order and the person who received it are usually not
    // managers, so the manager fan-out would never reach them.
    notifyUserIds: [createdById, receivedById].filter(Boolean),
    type: 'expense',
    detail: status === 'received'
      ? `It was already received at ${branchName} (${itemCount} item(s), ₹${totalAmount}); the linked purchase expense and its ledger entry were removed with it, but the stock it added was NOT reversed — correct it with an inventory adjustment if the goods never arrived.`
      : `It was ${status} at ${branchName} (${itemCount} item(s), ₹${totalAmount}) and had not moved any stock or money.`,
    metadata: {
      purchaseOrderId: poRef,
      supplier: supplierName,
      status,
      itemCount,
      totalAmount,
      expenseRemoved: Boolean(expenseId),
    },
  });

  res.json({ success: true, message: 'Purchase order removed' });
});

module.exports = {
  createSupplier, getSuppliers, updateSupplier, deleteSupplier,
  createPurchaseOrder, getPurchaseOrders, receivePurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder,
};
