const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Location = require('../models/Location');
const Table = require('../models/Table');
const OrderService = require('../services/orderService');

// PUBLIC, UNAUTHENTICATED endpoints for customer QR / online self-ordering.
// Everything is validated server-side; prices, stock and modifier deltas come
// from the database (never from the client), and rate limiting is applied at the
// route layer.

// @desc    Public menu for a branch (read-only)
// @route   GET /api/public/menu?branchId=
const getPublicMenu = asyncHandler(async (req, res) => {
  const { branchId } = req.query;
  if (!mongoose.isValidObjectId(branchId)) {
    res.status(400);
    throw new Error('A valid branch is required');
  }
  const branch = await Location.findById(branchId).select('name');
  if (!branch) {
    res.status(404);
    throw new Error('Branch not found');
  }

  const items = await MenuItem.find({
    isAvailable: true,
    $or: [{ isGlobal: true }, { availableBranches: branchId }],
  })
    .populate('category', 'name icon')
    .select('name price discountedPrice image description category dietaryType modifierGroups')
    .lean();

  res.json({ success: true, data: { branch: { _id: branch._id, name: branch.name }, items } });
});

// @desc    Place a customer self-order (QR / online)
// @route   POST /api/public/order
const createPublicOrder = asyncHandler(async (req, res) => {
  const { branchId, tableId, orderType, items, customerName, customerPhone } = req.body || {};

  if (!mongoose.isValidObjectId(branchId)) {
    res.status(400);
    throw new Error('A valid branch is required');
  }
  const branch = await Location.findById(branchId).select('_id');
  if (!branch) {
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
  if (type === 'dine-in') {
    if (!mongoose.isValidObjectId(tableId)) {
      res.status(400);
      throw new Error('A valid table is required for dine-in');
    }
    const table = await Table.findOne({ _id: tableId, locationId: branchId }).select('_id');
    if (!table) {
      res.status(400);
      throw new Error('That table does not belong to this branch');
    }
  }

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

  const order = await OrderService.createOrder({
    branch: branchId,
    tableId: type === 'dine-in' ? tableId : null,
    items: cleanItems,
    customerName: (customerName || 'Guest').toString().slice(0, 120),
    customerPhone: (customerPhone || '').toString().slice(0, 20),
    orderType: type,
    paymentType: 'CASH', // settled at the counter
    userId: null,
    source: 'qr',
  });

  res.status(201).json({ success: true, data: { orderId: order._id, status: order.status }, message: 'Order placed! Please pay at the counter.' });
});

module.exports = { getPublicMenu, createPublicOrder };
