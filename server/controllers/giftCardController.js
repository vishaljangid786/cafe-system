const asyncHandler = require('../utils/asyncHandler');
const GiftCard = require('../models/GiftCard');
const Order = require('../models/Order');
const { getSettings } = require('../utils/settings');
const { canAccessLocation, userLocationIds, clampLimit } = require('../utils/accessControl');

// The amount the customer actually owes for an order. Once finalized this is the
// stored grandTotal; before completion we derive it the same way the bill does
// (subtotal - discount + service charge + GST) so a gift card isn't under-debited
// by the tax/service portion.
const orderPayable = async (order) => {
  if (Number(order.grandTotal) > 0) return Number(order.grandTotal);
  const s = await getSettings(order.branch);
  const gstRate = Number(s?.tax?.gstRate) || 0;
  const svcRate = Number(s?.billing?.serviceChargeRate) || 0;
  const taxable = Math.max(0, Number(order.totalAmount || 0) - Number(order.discountAmount || 0));
  const serviceCharge = Number((taxable * svcRate / 100).toFixed(2));
  const taxes = Number(((taxable + serviceCharge) * gstRate / 100).toFixed(2));
  let total = taxable + serviceCharge + taxes;
  if (s?.billing?.roundBill !== false) total = Math.round(total);
  return total;
};

const genCode = () => `GC-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// @desc    Issue a new gift card
// @route   POST /api/gift-cards
const issueGiftCard = asyncHandler(async (req, res) => {
  const { amount, issuedToName, issuedToPhone, expiresAt, locationId } = req.body || {};
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    res.status(400);
    throw new Error('A positive amount is required');
  }
  let loc = null;
  if (locationId) {
    if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, locationId)) {
      res.status(403);
      throw new Error('You do not have access to this branch');
    }
    loc = locationId;
  } else if (['branch_admin', 'location_admin'].includes(req.user.role)) {
    loc = req.user.assignedLocation;
  }

  // Retry a couple of times in the (tiny) chance of a code collision.
  let card;
  for (let i = 0; i < 5 && !card; i++) {
    try {
      card = await GiftCard.create({
        code: genCode(),
        initialBalance: value,
        balance: value,
        locationId: loc,
        issuedToName: (issuedToName || '').toString().slice(0, 120),
        issuedToPhone: (issuedToPhone || '').toString().slice(0, 20),
        issuedBy: req.user._id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        transactions: [{ type: 'issue', amount: value, by: req.user._id }],
      });
    } catch (e) {
      if (e.code !== 11000) throw e; // retry only on duplicate code
    }
  }
  if (!card) {
    res.status(500);
    throw new Error('Could not generate a unique card code, please retry');
  }
  res.status(201).json({ success: true, data: card });
});

// @desc    Look up a gift card by code (balance check before redeeming)
// @route   GET /api/gift-cards/lookup/:code
const lookupGiftCard = asyncHandler(async (req, res) => {
  const card = await GiftCard.findOne({ code: (req.params.code || '').toUpperCase() }).select('code balance isActive expiresAt issuedToName');
  if (!card) {
    res.status(404);
    throw new Error('Gift card not found');
  }
  const expired = card.expiresAt && card.expiresAt < new Date();
  res.json({ success: true, data: { code: card.code, balance: card.balance, active: card.isActive && !expired, expired, issuedToName: card.issuedToName } });
});

// @desc    Redeem gift-card balance to settle an order (gift card = the tender)
// @route   POST /api/gift-cards/redeem
const redeemGiftCard = asyncHandler(async (req, res) => {
  const { code, amount, orderId } = req.body || {};
  const value = Number(amount);
  if (!code || !Number.isFinite(value) || value <= 0) {
    res.status(400);
    throw new Error('A valid code and positive amount are required');
  }

  // Redemption MUST settle a real order — otherwise the card balance (a liability)
  // would vanish off-books and a cashier could redeem + also collect cash.
  const order = await Order.findById(orderId);
  if (!order) {
    res.status(400);
    throw new Error('A valid order is required to redeem a gift card');
  }
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, order.branch)) {
    res.status(403);
    throw new Error('You do not have access to this order');
  }
  if (order.isRefunded) {
    res.status(400);
    throw new Error('Cannot redeem against a refunded order');
  }
  const orderTotal = await orderPayable(order);
  const outstanding = Math.max(0, orderTotal - Number(order.amountPaid || 0));
  if (outstanding <= 0) {
    res.status(400);
    throw new Error('This order is already fully paid');
  }
  // Never redeem more than the order still owes.
  const redeemValue = Math.min(value, outstanding);

  const upper = code.toUpperCase();
  const existing = await GiftCard.findOne({ code: upper });
  if (!existing) {
    res.status(404);
    throw new Error('Gift card not found');
  }
  if (!existing.isActive || (existing.expiresAt && existing.expiresAt < new Date())) {
    res.status(400);
    throw new Error('This gift card is inactive or expired');
  }
  // A branch-scoped card is only valid at its branch (and must match the order's branch).
  if (existing.locationId && existing.locationId.toString() !== order.branch.toString()) {
    res.status(400);
    throw new Error('This gift card belongs to another branch');
  }

  // Atomic guarded debit: only succeeds if the balance covers the amount, so two
  // concurrent redemptions can never overdraw the card.
  const card = await GiftCard.findOneAndUpdate(
    { code: upper, isActive: true, balance: { $gte: redeemValue } },
    { $inc: { balance: -redeemValue }, $push: { transactions: { type: 'redeem', amount: redeemValue, orderId: order._id, by: req.user._id } } },
    { new: true }
  );
  if (!card) {
    res.status(400);
    throw new Error(`Insufficient balance (available ₹${existing.balance})`);
  }

  // Settle the order: record the gift card as the tender so it can't be double-paid.
  // The card debit and order write aren't one DB transaction, so if the order
  // write fails we COMPENSATE by re-crediting the card (no money lost / orphaned).
  const newPaid = Number(order.amountPaid || 0) + redeemValue;
  try {
    order.amountPaid = newPaid;
    order.paymentType = 'GIFT_CARD';
    order.paymentStatus = newPaid >= orderTotal ? 'paid' : 'partial';
    await order.save();
  } catch (err) {
    await GiftCard.updateOne(
      { _id: card._id },
      { $inc: { balance: redeemValue }, $push: { transactions: { type: 'topup', amount: redeemValue, orderId: order._id, by: req.user._id, note: 'auto-reversal: order settle failed' } } }
    ).catch(() => {});
    throw err;
  }

  res.json({ success: true, data: { code: card.code, redeemed: redeemValue, balance: card.balance, orderPaid: newPaid, orderStatus: order.paymentStatus } });
});

// @desc    Top up a gift card
// @route   POST /api/gift-cards/:id/topup
const topupGiftCard = asyncHandler(async (req, res) => {
  const value = Number(req.body.amount);
  if (!Number.isFinite(value) || value <= 0) {
    res.status(400);
    throw new Error('A positive amount is required');
  }
  const card = await GiftCard.findById(req.params.id);
  if (!card) {
    res.status(404);
    throw new Error('Gift card not found');
  }
  // Branch scoping: a branch-specific card can only be topped up by someone with
  // access to that branch (org-wide cards are open to any admin).
  if (card.locationId && req.user.role !== 'super_admin' && !canAccessLocation(req.user, card.locationId)) {
    res.status(403);
    throw new Error('This gift card belongs to another branch');
  }
  // Don't credit a dead card — the balance would be unredeemable.
  if (!card.isActive || (card.expiresAt && card.expiresAt < new Date())) {
    res.status(400);
    throw new Error('Cannot top up an inactive or expired card');
  }
  card.balance += value;
  card.transactions.push({ type: 'topup', amount: value, by: req.user._id });
  await card.save();
  res.json({ success: true, data: card });
});

// @desc    List gift cards (branch-scoped)
// @route   GET /api/gift-cards
const getGiftCards = asyncHandler(async (req, res) => {
  const branchScoped = ['branch_admin', 'location_admin'].includes(req.user.role);
  const filter = {};
  if (branchScoped) {
    filter.$or = [{ locationId: null }, { locationId: req.user.assignedLocation }];
  } else if (req.user.role !== 'super_admin') {
    filter.$or = [{ locationId: null }, { locationId: { $in: userLocationIds(req.user) } }];
  }
  const cards = await GiftCard.find(filter).sort({ createdAt: -1 }).limit(clampLimit(req.query.limit, 100, 300));
  res.json({ success: true, data: cards });
});

module.exports = { issueGiftCard, lookupGiftCard, redeemGiftCard, topupGiftCard, getGiftCards };
