const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const GiftCard = require('../models/GiftCard');
const Order = require('../models/Order');
const { getSettings } = require('../utils/settings');
const { canAccessLocation, userLocationIds, clampLimit } = require('../utils/accessControl');
const sendNotification = require('../utils/sendNotification');
const { requireRecord, assertCanDelete, announceDeletion } = require('../utils/deleteGuard');
const { logAction } = require('../utils/auditLogger');

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

  await sendNotification({
    title: 'Gift Card Issued',
    message: `A gift card was issued by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: loc,
  });

  res.status(201).json({ success: true, data: card });
});

// @desc    Look up a gift card by code (balance check before redeeming)
// @route   GET /api/gift-cards/lookup/:code
const lookupGiftCard = asyncHandler(async (req, res) => {
  const card = await GiftCard.findOne({ code: (req.params.code || '').toUpperCase() }).select('code balance isActive expiresAt issuedToName locationId');
  if (!card) {
    res.status(404);
    throw new Error('Gift card not found');
  }
  // A branch-scoped card is only visible to users who can access its branch — stops
  // staff at one branch probing another branch's card balances by code. Global
  // (null-location) cards stay visible to any authorized user. Use 404 (not 403) so
  // the response doesn't confirm the card exists elsewhere.
  if (card.locationId && req.user.role !== 'super_admin' && !canAccessLocation(req.user, card.locationId)) {
    res.status(404);
    throw new Error('Gift card not found');
  }
  const expired = card.expiresAt && card.expiresAt < new Date();
  const canViewIssuedTo = req.user.role === 'super_admin' || req.user.permissions?.viewRevenue || req.user.permissions?.exportReports;
  res.json({
    success: true,
    data: {
      code: card.code,
      balance: card.balance,
      active: card.isActive && !expired,
      expired,
      issuedToName: canViewIssuedTo ? card.issuedToName : undefined,
    }
  });
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

  // Settle the order ATOMICALLY. The card debit and the order write are not one DB
  // transaction, so guarding the order update on the amountPaid we observed turns it
  // into a compare-and-set: if another payment/redemption changed the order in the
  // meantime, the update matches nothing and we COMPENSATE the card debit instead of
  // silently losing money. (Previously this was a stale read-modify-write —
  // order.amountPaid = old + value; order.save() — so two DIFFERENT cards settling
  // the same order concurrently both debited but only one was credited to the order.)
  const observedPaid = Number(order.amountPaid || 0);
  const newPaid = observedPaid + redeemValue;
  const newStatus = newPaid >= orderTotal ? 'paid' : 'partial';

  let settled = null;
  try {
    settled = await Order.findOneAndUpdate(
      { _id: order._id, isRefunded: { $ne: true }, amountPaid: observedPaid },
      { $set: { amountPaid: newPaid, paymentType: 'GIFT_CARD', paymentStatus: newStatus } },
      { new: true }
    );
  } catch (err) {
    settled = null;
  }

  if (!settled) {
    // Order write failed or lost a concurrency race — re-credit the card so no
    // balance is orphaned, then ask the caller to retry against the fresh order.
    await GiftCard.updateOne(
      { _id: card._id },
      { $inc: { balance: redeemValue }, $push: { transactions: { type: 'topup', amount: redeemValue, orderId: order._id, by: req.user._id, note: 'auto-reversal: order settle failed/raced' } } }
    ).catch(() => {});
    res.status(409);
    throw new Error('This order was just updated by another payment. Please refresh and try again.');
  }

  await sendNotification({
    title: 'Gift Card Redeemed',
    message: `A gift card was redeemed by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: order.branch,
  });

  res.json({ success: true, data: { code: card.code, redeemed: redeemValue, balance: card.balance, orderPaid: settled.amountPaid, orderStatus: settled.paymentStatus } });
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

  await sendNotification({
    title: 'Gift Card Topped Up',
    message: `A gift card was topped up by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: card.locationId,
  });

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

// @desc    Delete a gift card (mis-issued card, duplicate, test row)
// @route   DELETE /api/gift-cards/:id
// @access  Private (giftcards.delete)
const deleteGiftCard = asyncHandler(async (req, res) => {
  // A malformed id would surface as a CastError 500; the operator needs to know
  // their row reference is stale, not that the server broke.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400);
    throw new Error('That gift card id is not valid. Refresh the gift card list and try again.');
  }

  const card = await GiftCard.findById(req.params.id);
  requireRecord(res, card, 'Gift card');

  // locationId is deliberately passed through even when null: an org-wide card has
  // no branch to scope against, so assertCanDelete falls back to the global-role
  // check (super_admin / admin) instead of letting any branch admin erase it.
  // No `ownerId` — the issuer does not own the card, the customer's money does.
  assertCanDelete(req, res, {
    resource: 'gift card',
    actionKey: 'giftcards.delete',
    locationId: card.locationId,
  });

  const isSuperAdmin = req.user.role === 'super_admin';
  const balance = Number(card.balance || 0);
  const redeemed = card.transactions.some((t) => t.type === 'redeem');

  // Guard 1 — a remaining balance is a live liability: real money the cafe already
  // took and still owes the bearer. Erasing the row makes the debt disappear from
  // the books while the customer still holds the card. Deactivating first is the
  // deliberate act that writes the liability off with a trail.
  if (balance > 0 && !isSuperAdmin) {
    res.status(400);
    throw new Error(
      `This gift card still holds a balance of ₹${balance} that is owed to the customer. Deactivate the card and zero its balance deliberately before deleting it, or ask a super admin to remove it.`
    );
  }

  // Guard 2 — a card that has ever been redeemed is payment evidence: the orders it
  // settled record only `paymentType: 'GIFT_CARD'`, so this document's transaction
  // log is the ONLY link between those orders and the tender that paid them.
  // Cascade decision: we do NOT touch the settled orders (they are paid and correct);
  // instead we keep the card and deactivate it, which removes it from circulation
  // without destroying the trail. Only a super_admin may hard-delete the history.
  if (redeemed && !isSuperAdmin) {
    if (!card.isActive) {
      res.status(400);
      throw new Error(
        'This gift card has already been redeemed against an order and is already deactivated. Its history is the only record linking that order to the gift-card tender, so only a super admin can erase it.'
      );
    }
    card.isActive = false;
    await card.save();

    await sendNotification({
      title: 'Gift Card Deactivated',
      message: `Gift card "${card.code}" was deactivated by ${req.user.name} instead of being deleted, because it has redemption history.`,
      type: 'activity',
      priority: 'high',
      performedByUser: req.user,
      locationId: card.locationId,
      notifyUserIds: card.issuedBy ? [card.issuedBy] : undefined,
    });
    await logAction(req, 'GIFTCARD_DEACTIVATE', {
      resource: 'GiftCard',
      code: card.code,
      locationId: card.locationId ? card.locationId.toString() : null,
      reason: 'redeemed card cannot be hard-deleted by a non-super-admin',
    });

    return res.json({
      success: true,
      deactivated: true,
      data: card,
      message: `Gift card ${card.code} has been redeemed before, so it was deactivated instead of deleted — its redemption history is kept as proof of payment.`,
    });
  }

  await card.deleteOne();

  // Cascade: transactions are embedded in this document, so nothing is orphaned by
  // the delete. Orders never reference a GiftCard _id, so no order is left dangling
  // either — the only loss is the tender trail, which is why guard 2 exists.
  const detail = balance > 0
    ? `The card still held ₹${balance}; that outstanding liability has been written off.`
    : '';

  await announceDeletion(req, {
    resource: 'Gift card',
    name: card.code,
    locationId: card.locationId,
    action: 'GIFTCARD_DELETE',
    type: 'activity',
    // The person who issued the card is usually a cashier, not a manager, so the
    // standard manager fan-out never reaches them — but they are the one who will
    // be asked about it when the customer turns up with the card.
    notifyUserIds: card.issuedBy ? [card.issuedBy] : undefined,
    metadata: { code: card.code, balance, initialBalance: card.initialBalance, hadRedemptions: redeemed },
    detail,
  });

  res.json({ success: true, message: `Gift card ${card.code} removed` });
});

module.exports = { issueGiftCard, lookupGiftCard, redeemGiftCard, topupGiftCard, getGiftCards, deleteGiftCard };
