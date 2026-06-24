// Integration tests against the REAL models + services using an in-memory MongoDB
// replica set (transactions supported). Run: npm run test:int
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const OrderService = require('../services/orderService');
const { finalizeOrder } = require('../utils/orderFinalizer');
const { num, loyaltyTier } = require('../utils/settings');

const Location = require('../models/Location');
const User = require('../models/User');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const BranchStock = require('../models/BranchStock');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

let replset;
let loc, admin, category;

before(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replset.getUri());

  // Build all indexes up-front. Otherwise the single-node in-memory replset tries
  // to create indexes lazily on first insert *inside* a transaction, which Mongo
  // rejects as a "catalog change" — test-only flakiness, not an app bug.
  const Table = require('../models/Table');
  const GiftCard = require('../models/GiftCard');
  const Reservation = require('../models/Reservation');
  await Promise.all([Location, User, Category, MenuItem, BranchStock, Order, Transaction, Table, GiftCard, Reservation].map((M) => M.init()));

  loc = await Location.create({ name: 'Test Cafe', city: 'Pune', state: 'MH', country: 'IN', pincode: '411001', createdBy: new mongoose.Types.ObjectId(), maxCapacity: 20, status: 'active' });
  admin = await User.create({ name: 'Admin', email: 'admin@test.com', password: 'Secret123!', phone: '9999999999', gender: 'Male', address1: 'Addr', city: 'Pune', assignedLocation: loc._id, accessibleLocations: [loc._id], role: 'super_admin' });
  category = await Category.create({ name: 'Mains', createdBy: admin._id });
});

after(async () => {
  await mongoose.disconnect();
  await replset.stop();
});

// Helper: a branch-stocked menu item (non-recipe) + its BranchStock row.
async function stockedItem({ price, discountedPrice, modifierGroups, stock = 100 }) {
  const item = await MenuItem.create({
    name: `Item-${Math.random().toString(36).slice(2, 7)}`,
    price, discountedPrice, category: category._id, createdBy: admin._id,
    availableBranches: [loc._id], isAvailable: true,
    ...(modifierGroups ? { modifierGroups } : {}),
  });
  await BranchStock.create({ branch: loc._id, menuItem: item._id, stock, isAvailable: true });
  return item;
}

async function makeTable() {
  const Table = require('../models/Table');
  return Table.create({ locationId: loc._id, tableNumber: Math.floor(Math.random() * 100000), capacity: 4 });
}

test('settings helpers: num() preserves 0; loyaltyTier thresholds', () => {
  assert.strictEqual(num(0, 10), 0, '0 must be preserved, not replaced by fallback');
  assert.strictEqual(num('', 10), 10);
  assert.strictEqual(num(undefined, 10), 10);
  assert.strictEqual(num('5', 1), 5);
  assert.strictEqual(loyaltyTier(0), 'Bronze');
  assert.strictEqual(loyaltyTier(6000), 'Silver');
  assert.strictEqual(loyaltyTier(25000), 'Gold');
  assert.strictEqual(loyaltyTier(60000), 'Platinum');
});

test('order: create + finalize computes GST/grandTotal, settles, deducts stock, records revenue', async () => {
  const item = await stockedItem({ price: 100 });
  const table = await makeTable();
  const order = await OrderService.createOrder({
    branch: loc._id, tableId: table._id, orderType: 'dine-in',
    items: [{ menuItem: item._id, quantity: 2 }], userId: admin._id,
  });
  assert.strictEqual(order.totalAmount, 200, 'subtotal = 100 x 2');

  const finalized = await finalizeOrder(order, admin);
  assert.strictEqual(finalized.taxAmount, 10, 'GST 5% of 200 = 10');
  assert.strictEqual(finalized.grandTotal, 210, 'grandTotal = 200 + 10');
  assert.strictEqual(finalized.amountPaid, 210, 'unpaid -> settled at grandTotal');
  assert.strictEqual(finalized.paymentStatus, 'paid');

  const stock = await BranchStock.findOne({ menuItem: item._id, branch: loc._id });
  assert.strictEqual(stock.stock, 98, 'stock 100 - 2 = 98');

  const rev = await Transaction.findOne({ orderId: order._id, type: 'REVENUE' });
  assert.ok(rev, 'a REVENUE transaction is recorded');
  assert.strictEqual(rev.totalAmount, 200, 'revenue is GST-exclusive subtotal');
});

test('order: discountedPrice is honored (not full price)', async () => {
  const item = await stockedItem({ price: 100, discountedPrice: 80 });
  const table = await makeTable();
  const order = await OrderService.createOrder({
    branch: loc._id, tableId: table._id, orderType: 'dine-in',
    items: [{ menuItem: item._id, quantity: 1 }], userId: admin._id,
  });
  assert.strictEqual(order.totalAmount, 80, 'billed at discountedPrice 80, not 100');
});

test('order: modifier pricing + required-group enforcement', async () => {
  const groups = [{ name: 'Size', selectionType: 'single', required: true, options: [{ label: 'Large', priceDelta: 40 }] }];
  const item = await stockedItem({ price: 100, modifierGroups: groups });
  const table = await makeTable();

  // Required group omitted -> must throw.
  await assert.rejects(
    () => OrderService.createOrder({ branch: loc._id, tableId: table._id, orderType: 'dine-in', items: [{ menuItem: item._id, quantity: 1 }], userId: admin._id }),
    /choose Size/i,
    'omitting a required modifier group should be rejected'
  );

  // Valid selection -> price = base + delta.
  const table2 = await makeTable();
  const order = await OrderService.createOrder({
    branch: loc._id, tableId: table2._id, orderType: 'dine-in',
    items: [{ menuItem: item._id, quantity: 1, modifiers: [{ groupName: 'Size', label: 'Large' }] }],
    userId: admin._id,
  });
  assert.strictEqual(order.totalAmount, 140, 'base 100 + Large 40');
  assert.strictEqual(order.items[0].modifiers.length, 1);
  assert.strictEqual(order.items[0].modifiers[0].priceDelta, 40);
});

test('order: modifier price cannot be tampered (server uses stored delta, ignores client price)', async () => {
  const groups = [{ name: 'Add', selectionType: 'multiple', required: false, options: [{ label: 'Cheese', priceDelta: 20 }] }];
  const item = await stockedItem({ price: 50, modifierGroups: groups });
  const table = await makeTable();
  const order = await OrderService.createOrder({
    branch: loc._id, tableId: table._id, orderType: 'dine-in',
    // client tries to send a bogus negative delta + duplicate selections
    items: [{ menuItem: item._id, quantity: 1, modifiers: [
      { groupName: 'Add', label: 'Cheese', priceDelta: -999 },
      { groupName: 'Add', label: 'Cheese' },
    ] }],
    userId: admin._id,
  });
  assert.strictEqual(order.totalAmount, 70, 'base 50 + Cheese 20 once (deduped, server delta) — client -999 ignored');
});

// Minimal mock req/res to drive asyncHandler controllers directly. asyncHandler is
// fire-and-forget (doesn't return its promise), so we resolve when res.json or
// next() is actually invoked.
function callController(handler, { body = {}, params = {}, query = {} } = {}) {
  const req = { body, params, query, user: admin };
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resolve({ statusCode, data: d }); return this; },
    };
    const next = (e) => {
      if (e) { const err = new Error(e.message); err.statusCode = statusCode; reject(err); }
      else resolve({ statusCode, data: undefined });
    };
    handler(req, res, next);
  });
}

test('gift card: redeem settles order at true payable (incl GST), refund restores balance', async () => {
  const { issueGiftCard, redeemGiftCard } = require('../controllers/giftCardController');
  const { refundOrder } = require('../controllers/orderController');
  const GiftCard = require('../models/GiftCard');

  // issueGiftCard controller works (creates a card).
  const issued = await callController(issueGiftCard, { body: { amount: 250 } });
  assert.strictEqual(issued.statusCode, 201, 'issueGiftCard returns 201');
  assert.strictEqual(issued.data.data.balance, 250);

  // Card for the redeem/refund flow (scoped to this branch).
  const card = await GiftCard.create({ code: 'GC-TESTAA', initialBalance: 500, balance: 500, locationId: loc._id, issuedBy: admin._id, transactions: [{ type: 'issue', amount: 500, by: admin._id }] });

  // An order of ₹100 (true payable = 100 + 5% GST = 105).
  const item = await stockedItem({ price: 100 });
  const table = await makeTable();
  const order = await OrderService.createOrder({
    branch: loc._id, tableId: table._id, orderType: 'dine-in',
    items: [{ menuItem: item._id, quantity: 1 }], userId: admin._id,
  });

  // Try to over-redeem ₹1000 — must cap at the ₹105 outstanding.
  const redeemRes = await callController(redeemGiftCard, { body: { code: card.code, amount: 1000, orderId: order._id.toString() } });
  assert.strictEqual(redeemRes.data.data.redeemed, 105, 'capped at outstanding incl GST');
  const afterRedeem = await GiftCard.findById(card._id);
  assert.strictEqual(afterRedeem.balance, 395, '500 - 105');
  const paidOrder = await Order.findById(order._id);
  assert.strictEqual(paidOrder.paymentType, 'GIFT_CARD');
  assert.strictEqual(paidOrder.amountPaid, 105);

  // Complete + bill the order, then refund — the card balance must be restored.
  await finalizeOrder(paidOrder, admin);
  await Order.updateOne({ _id: order._id }, { $set: { status: 'COMPLETED', isBilled: true } });
  await callController(refundOrder, { params: { id: order._id.toString() }, body: { reason: 'test' } });
  const afterRefund = await GiftCard.findById(card._id);
  assert.strictEqual(afterRefund.balance, 500, 'refund restores the redeemed gift-card value');
});

test('cash drawer: open -> cash sale -> close computes expected cash & variance', async () => {
  const { openDrawer, getCurrentDrawer, closeDrawer } = require('../controllers/cashDrawerController');

  const open = await callController(openDrawer, { body: { openingFloat: 1000, locationId: loc._id.toString() } });
  assert.strictEqual(open.statusCode, 201);
  const sessionId = open.data.data._id.toString();

  // A completed CASH order of 200 -> grandTotal 210 (5% GST) becomes a cash sale.
  const item = await stockedItem({ price: 200 });
  const table = await makeTable();
  const order = await OrderService.createOrder({ branch: loc._id, tableId: table._id, orderType: 'dine-in', items: [{ menuItem: item._id, quantity: 1 }], userId: admin._id, paymentType: 'CASH' });
  await finalizeOrder(order, admin);

  const cur = await callController(getCurrentDrawer, { query: { locationId: loc._id.toString() } });
  assert.strictEqual(cur.data.data.live.cashSales, 210, 'cash sale counted = grandTotal');
  assert.strictEqual(cur.data.data.live.expectedCash, 1210, 'float 1000 + 210');

  const close = await callController(closeDrawer, { params: { id: sessionId }, body: { countedCash: 1210 } });
  assert.strictEqual(close.data.data.variance, 0, 'counted matches expected -> balanced');
});

test('procurement: receiving a PO adds branch stock and books COGS to the ledger', async () => {
  const { createSupplier, createPurchaseOrder, receivePurchaseOrder } = require('../controllers/purchaseController');
  const Ingredient = require('../models/Ingredient');
  const BranchInventory = require('../models/BranchInventory');
  const Expense = require('../models/Expense');

  const ing = await Ingredient.create({ name: 'Milk', unit: 'L' });
  const sup = await callController(createSupplier, { body: { name: 'Dairy Co', locationId: loc._id.toString() } });
  const po = await callController(createPurchaseOrder, { body: { supplier: sup.data.data._id.toString(), locationId: loc._id.toString(), items: [{ ingredient: ing._id.toString(), name: 'Milk', unit: 'L', quantity: 10, unitCost: 5 }] } });
  assert.strictEqual(po.data.data.totalAmount, 50);

  const recv = await callController(receivePurchaseOrder, { params: { id: po.data.data._id.toString() } });
  assert.strictEqual(recv.data.data.status, 'received');

  const inv = await BranchInventory.findOne({ ingredient: ing._id, branch: loc._id });
  assert.strictEqual(inv.stock, 10, 'PO stock added to branch inventory');
  const exp = await Expense.findById(recv.data.data.expenseId);
  assert.ok(exp && exp.amount === 50 && exp.category === 'Inventory', 'COGS expense booked to ledger');
});

test('payroll: PAID approval posts a Salary expense to the ledger (once)', async () => {
  const { approvePayroll } = require('../controllers/salaryController');
  const Payroll = require('../models/Payroll');
  const Expense = require('../models/Expense');

  const staff = await User.create({ name: 'Staff1', email: 's1@test.com', password: 'Secret123!', phone: '8888888888', gender: 'Male', address1: 'A', city: 'Pune', assignedLocation: loc._id, role: 'staff', monthlySalary: 30000 });
  const payroll = await Payroll.create({ user: staff._id, month: '2026-05', dailyRate: 1000, payableDays: 30, baseSalary: 30000, netSalary: 30000, status: 'FINAL_APPROVED' });

  const res = await callController(approvePayroll, { params: { id: payroll._id.toString() } });
  assert.strictEqual(res.data.data.status, 'PAID');
  const updated = await Payroll.findById(payroll._id);
  assert.ok(updated.ledgerExpenseId, 'ledgerExpenseId set');
  const exp = await Expense.findById(updated.ledgerExpenseId);
  assert.ok(exp && exp.category === 'Salary' && exp.amount === 30000, 'salary expense posted to ledger');
});

test('booking availability accounts for a full-location reservation (M1 cross-check)', async () => {
  const { checkAvailability } = require('../controllers/bookingController');
  const Reservation = require('../models/Reservation');
  const date = '2030-03-15';

  await Reservation.create({ eventName: 'Party', reservationType: 'full-location', date: new Date(date), startTime: '18:00', endTime: '22:00', totalAmount: 5000, customerName: 'X', customerPhone: '7777777777', userId: admin._id, locationId: loc._id, status: 'confirmed' });

  const res = await callController(checkAvailability, { query: { locationId: loc._id.toString(), date, startTime: '19:00', endTime: '20:00', numberOfGuests: '2' } });
  assert.strictEqual(res.data.available, false, 'a full-location reservation blocks public booking capacity');
});

test('waitlist: seating a party marks the table booked', async () => {
  const { addToWaitlist, updateWaitlistEntry } = require('../controllers/waitlistController');
  const Table = require('../models/Table');

  const add = await callController(addToWaitlist, { body: { customerName: 'Walk-in', partySize: 3, locationId: loc._id.toString() } });
  const table = await makeTable();
  const upd = await callController(updateWaitlistEntry, { params: { id: add.data.data._id.toString() }, body: { status: 'seated', tableId: table._id.toString() } });
  assert.strictEqual(upd.data.data.status, 'seated');

  const t = await Table.findById(table._id);
  assert.strictEqual(t.isBooked, true, 'seated table is marked booked');
  assert.strictEqual(t.status, 'booked');
});
