const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Location = require('../models/Location');
const Table = require('../models/Table');
const Order = require('../models/Order');
const BranchStock = require('../models/BranchStock');
const Recipe = require('../models/Recipe');
const OrderService = require('../services/orderService');
const { getSettings } = require('../utils/settings');

// PUBLIC, UNAUTHENTICATED endpoints for customer QR / online self-ordering.
// Everything is validated server-side; prices, stock and modifier deltas come
// from the database (never from the client), and rate limiting is applied at the
// route layer.

// Only the payment fields the customer needs — never leak internal config.
const publicPayments = (settings) => ({
  upiVpa: settings.payments?.upiVpa || '',
  upiName: settings.payments?.upiName || '',
  acceptUpi: settings.payments?.acceptUpi !== false && !!settings.payments?.upiVpa,
  acceptCash: settings.payments?.acceptCash !== false,
  requireApproval: settings.payments?.requireApprovalForQr !== false,
});

// Top items for a branch over the last 45 days, from orders that actually reached
// the kitchen (so a table full of unconfirmed/rejected self-orders can't skew it).
const getPopularItems = async (branchId, limit = 6) => {
  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  try {
    const rows = await Order.aggregate([
      {
        $match: {
          branch: new mongoose.Types.ObjectId(branchId),
          status: { $in: ['PREPARING', 'READY', 'SERVED', 'COMPLETED'] },
          createdAt: { $gte: since },
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.menuItem': { $ne: null } } },
      {
        $group: {
          _id: '$items.menuItem',
          name: { $last: '$items.itemName' },
          count: { $sum: '$items.quantity' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r) => ({ menuItem: r._id, name: r.name, count: r.count }));
  } catch (e) {
    return [];
  }
};

// @desc    Public menu for a branch (read-only) + optional table + payment config
// @route   GET /api/public/menu?branchId=&tableId=
const getPublicMenu = asyncHandler(async (req, res) => {
  const { branchId, tableId } = req.query;
  if (!mongoose.isValidObjectId(branchId)) {
    res.status(400);
    throw new Error('A valid branch is required');
  }
  const branch = await Location.findById(branchId).select('name city status');
  if (!branch || branch.status === 'deleted' || branch.status === 'inactive') {
    res.status(404);
    throw new Error('Branch not found');
  }

  // Resolve the scanned table (if any) so the scan page can greet the guest and
  // cap the party size to the table's real capacity.
  let table = null;
  if (tableId && mongoose.isValidObjectId(tableId)) {
    const t = await Table.findOne({ _id: tableId, locationId: branchId })
      .select('tableNumber tableName capacity status')
      .lean();
    if (t) {
      table = {
        _id: t._id,
        tableNumber: t.tableNumber,
        tableName: t.tableName || '',
        capacity: t.capacity || 1,
        status: t.status,
      };
    }
  }

  const [rawItems, settings, popular] = await Promise.all([
    MenuItem.find({
      isAvailable: true,
      $or: [{ isGlobal: true }, { availableBranches: branchId }],
    })
      .populate('category', 'name icon')
      .select('name price discountedPrice image description category dietaryType modifierGroups isGlobal stock recipeId')
      .lean(),
    getSettings(branchId),
    getPopularItems(branchId),
  ]);

  // Merge per-branch stock so the customer sees live quantities, and DROP anything
  // that can't actually be ordered right now (out of stock / not stocked here).
  const ids = rawItems.map((i) => i._id);
  const [branchStocks, recipes] = await Promise.all([
    BranchStock.find({ branch: branchId, menuItem: { $in: ids } }).select('menuItem stock isAvailable').lean(),
    Recipe.find({ menuItemId: { $in: ids } }).select('menuItemId').lean(),
  ]);
  const stockMap = new Map(branchStocks.map((s) => [s.menuItem.toString(), s]));
  const recipeSet = new Set(recipes.map((r) => r.menuItemId.toString()));

  const items = [];
  for (const it of rawItems) {
    const idStr = it._id.toString();
    const bs = stockMap.get(idStr);
    const isRecipe = recipeSet.has(idStr) || it.recipeId != null;

    let orderable = false;
    let stock = null;      // number of units left, when the item is stock-tracked
    let tracksStock = false;

    if (bs) {
      tracksStock = true;
      stock = bs.stock;
      orderable = bs.isAvailable !== false && bs.stock > 0;
    } else if (isRecipe) {
      // Made-to-order (ingredient-based) — no unit stock to show.
      orderable = true;
    } else if (it.isGlobal) {
      tracksStock = true;
      stock = it.stock || 0;
      orderable = (it.stock || 0) > 0;
    } else {
      // Not stocked at this branch → can't be ordered here.
      orderable = false;
    }

    if (!orderable) continue; // hide out-of-stock / unavailable items entirely

    const { isGlobal, stock: _s, recipeId, ...pub } = it;
    items.push({ ...pub, tracksStock, ...(tracksStock ? { stock } : {}) });
  }

  res.json({
    success: true,
    data: {
      branch: { _id: branch._id, name: branch.name, city: branch.city },
      table,
      payments: publicPayments(settings),
      popular,
      items,
    },
  });
});

// @desc    Place a customer self-order (QR / online)
// @route   POST /api/public/order
const createPublicOrder = asyncHandler(async (req, res) => {
  const {
    branchId, tableId, orderType, items,
    customerName, customerPhone, members, numberOfPeople,
    paymentChoice, payLaterMethod, upiRef,
  } = req.body || {};

  if (!mongoose.isValidObjectId(branchId)) {
    res.status(400);
    throw new Error('A valid branch is required');
  }
  const branch = await Location.findById(branchId).select('_id status');
  if (!branch || branch.status === 'deleted') {
    res.status(404);
    throw new Error('Branch not found');
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Your cart is empty');
  }
  // Hard cap to keep a public endpoint from being abused with huge payloads.
  if (items.length > 50) {
    res.status(400);
    throw new Error('Too many items in one order');
  }

  const type = ['dine-in', 'takeaway'].includes(orderType) ? orderType : (tableId ? 'dine-in' : 'takeaway');

  // For dine-in, the table must exist AND belong to this branch.
  let tableDoc = null;
  if (type === 'dine-in') {
    if (!mongoose.isValidObjectId(tableId)) {
      res.status(400);
      throw new Error('A valid table is required for dine-in');
    }
    tableDoc = await Table.findOne({ _id: tableId, locationId: branchId }).select('_id capacity');
    if (!tableDoc) {
      res.status(400);
      throw new Error('That table does not belong to this branch');
    }
  }

  // Party members + headcount, clamped to the table capacity.
  const capacity = tableDoc?.capacity || 50;
  const cleanMembers = Array.isArray(members)
    ? members.map((m) => (m || '').toString().trim()).filter(Boolean).slice(0, capacity)
    : [];
  let people = Math.floor(Number(numberOfPeople) || 0);
  if (people < 0) people = 0;
  people = Math.min(people, capacity);
  if (cleanMembers.length > people) people = cleanMembers.length;

  // Normalize items — only pass menuItem id, quantity, notes, modifiers; the
  // service looks up authoritative prices/stock/modifier deltas itself.
  const cleanItems = items
    .filter((i) => i && mongoose.isValidObjectId(i.menuItem) && Number(i.quantity) > 0)
    .map((i) => ({
      menuItem: i.menuItem,
      quantity: Math.min(99, Math.max(1, Math.floor(Number(i.quantity)))),
      notes: (i.notes || '').toString().slice(0, 200),
      modifiers: Array.isArray(i.modifiers) ? i.modifiers.slice(0, 20) : [],
    }));
  if (cleanItems.length === 0) {
    res.status(400);
    throw new Error('No valid items in the order');
  }

  // Re-validate every item against the SAME filter the public menu uses: available
  // and assigned to this branch. The order endpoint must not accept items the
  // customer was never shown (cross-branch / disabled / off-menu ids).
  const allowed = await MenuItem.find({
    _id: { $in: cleanItems.map((i) => i.menuItem) },
    isAvailable: true,
    $or: [{ isGlobal: true }, { availableBranches: branchId }],
  }).select('_id').lean();
  const allowedSet = new Set(allowed.map((i) => i._id.toString()));
  if (cleanItems.some((i) => !allowedSet.has(i.menuItem.toString()))) {
    res.status(400);
    throw new Error('One or more items are not available at this branch');
  }

  // Payment intent. The customer either prepays now via UPI, or elects to settle
  // at the counter later (cash or UPI). Either way the order waits for a staff
  // member to confirm the money before it is sent to the kitchen (unless the
  // branch has turned approval off in settings).
  const settings = await getSettings(branchId);
  const pay = publicPayments(settings);

  const wantsUpiNow = paymentChoice === 'pay_now_upi';
  if (wantsUpiNow && !pay.acceptUpi) {
    res.status(400);
    throw new Error('UPI payment is not enabled for this branch');
  }
  const laterMethod = ['CASH', 'UPI'].includes(payLaterMethod) ? payLaterMethod : 'CASH';
  if (!wantsUpiNow && laterMethod === 'CASH' && !pay.acceptCash) {
    res.status(400);
    throw new Error('Cash payment is not accepted at this branch');
  }

  const method = wantsUpiNow ? 'UPI' : laterMethod;
  const requireApproval = pay.requireApproval;
  const initialStatus = requireApproval ? 'AWAITING_APPROVAL' : 'PLACED';
  const paymentApproval = {
    status: requireApproval ? 'pending' : 'not_required',
    method,
    upiRef: (upiRef || '').toString().slice(0, 40) || null,
    note: wantsUpiNow ? 'Customer marked UPI paid — verify reference' : (method === 'CASH' ? 'Pay cash at counter' : 'Pay UPI at counter'),
    approvedBy: null,
    approvedAt: null,
  };

  const order = await OrderService.createOrder({
    branch: branchId,
    tableId: type === 'dine-in' ? tableId : null,
    items: cleanItems,
    customerName: (customerName || 'Guest').toString().slice(0, 120),
    customerPhone: (customerPhone || '').toString().replace(/\D/g, '').slice(0, 15),
    members: cleanMembers,
    numberOfPeople: people,
    orderType: type,
    paymentType: method,
    prepaid: false, // becomes true only once staff confirm a full UPI prepayment
    userId: null,
    source: 'qr',
    initialStatus,
    paymentApproval,
  });

  const message = requireApproval
    ? (wantsUpiNow
        ? 'Order received! We are confirming your UPI payment — please wait a moment.'
        : 'Order received! Please pay at the counter; our staff will confirm it shortly.')
    : 'Order placed! Thank you.';

  res.status(201).json({
    success: true,
    data: {
      orderId: order._id,
      status: order.status,
      approvalStatus: order.paymentApproval?.status || 'not_required',
      total: order.totalAmount,
      method,
    },
    message,
  });
});

// @desc    Lightweight status probe so the scan page can show "confirmed" live
// @route   GET /api/public/order/:id
const getPublicOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { branchId } = req.query;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(branchId)) {
    res.status(400);
    throw new Error('Invalid order');
  }
  // Bind the lookup to the branch the customer scanned. Without this, an anonymous
  // caller could iterate ObjectIds and read the status/total of ANY order in ANY
  // branch or cafe (cross-tenant enumeration). The scan page already knows branchId
  // from the QR, so this is transparent to the real customer.
  const order = await Order.findOne({ _id: id, branch: branchId })
    .select('status paymentApproval.status paymentStatus totalAmount')
    .lean();
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  res.json({
    success: true,
    data: {
      status: order.status,
      approvalStatus: order.paymentApproval?.status || 'not_required',
      paymentStatus: order.paymentStatus,
      confirmed: !['AWAITING_APPROVAL', 'REJECTED', 'CANCELLED'].includes(order.status),
      declined: ['REJECTED', 'CANCELLED'].includes(order.status),
    },
  });
});

module.exports = { getPublicMenu, createPublicOrder, getPublicOrderStatus };
