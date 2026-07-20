// Executable verification for super-admin destructive operations:
// soft delete, cascade, replacement, purge, restore, and cafe lockout.
//
// Run: npm run test:destructive
//
// These assert behaviour that is expensive to get wrong — a removed employee
// still drawing payroll, a cascade eating revenue history, a blocked cafe whose
// staff can still log in. Everything runs against real models on an in-memory
// MongoDB, so the dependency registry and the engine are exercised as written.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'y'.repeat(64);

const User = require('../models/User');
const Cafe = require('../models/Cafe');
const Location = require('../models/Location');
const Table = require('../models/Table');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const Payroll = require('../models/Payroll');
const Reservation = require('../models/Reservation');

const {
  previewUserImpact,
  previewCafeImpact,
  previewLocationImpact,
  executeCafePurge,
  executeLocationPurge,
  softDeleteUsers,
  findSubordinates,
  findReplacementCandidates,
} = require('../services/cascadeDelete');
const { getSuspensionFor, invalidateTenantCache } = require('../utils/tenantStatus');

let mem;
let superAdmin;

const uniq = () => Math.random().toString(36).slice(2, 8);

const mkUser = (over = {}) =>
  User.create({
    name: over.name || `User-${uniq()}`,
    email: over.email || `u${uniq()}@test.com`,
    password: 'Secret123!!',
    phone: '9999999999',
    gender: 'Male',
    address1: 'Addr',
    city: 'Pune',
    ...over,
  });

before(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: 'destructive' });
  await Promise.all(
    [User, Cafe, Location, Table, Category, MenuItem, Order, Expense, Transaction, Payroll, Reservation].map((M) =>
      M.init()
    )
  );
  superAdmin = await mkUser({ role: 'super_admin', name: 'Root' });
}, { timeout: 120000 });

after(async () => {
  await mongoose.disconnect();
  if (mem) await mem.stop();
}, { timeout: 30000 });

// Each test builds its own cafe so counts never bleed between them.
const buildCafe = async ({ branches = 1 } = {}) => {
  const cafe = await Cafe.create({ name: `Cafe-${uniq()}`, createdBy: superAdmin._id });
  const locs = [];
  for (let i = 0; i < branches; i++) {
    locs.push(
      await Location.create({
        cafe: cafe._id,
        name: `Branch-${uniq()}`,
        city: 'Pune',
        state: 'MH',
        country: 'IN',
        pincode: '411001',
        createdBy: superAdmin._id,
        maxCapacity: 20,
        status: 'active',
      })
    );
  }
  invalidateTenantCache();
  return { cafe, locs };
};

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

test('soft delete hides the user but keeps the document resolvable', async () => {
  const { locs } = await buildCafe();
  const staff = await mkUser({ role: 'staff', assignedLocation: locs[0]._id, name: 'Ravi' });
  const originalEmail = staff.email;

  await softDeleteUsers([staff._id], { actorId: superAdmin._id, reason: 'left' });

  const fresh = await User.findById(staff._id);
  assert.ok(fresh, 'document must survive so history can resolve it');
  assert.ok(fresh.deletedAt, 'deletedAt is set');
  assert.equal(fresh.isBlocked, true, 'removed account is blocked');
  assert.equal(fresh.active, false, 'removed account is inactive');
  assert.equal(fresh.name, 'Ravi', 'name is retained for historical records');
  assert.equal(fresh.deletedEmail, originalEmail, 'original address parked for restore');
  assert.notEqual(fresh.email, originalEmail, 'live address released');

  // Hidden from a normal listing.
  const listed = await User.find({ role: 'staff', deletedAt: null, _id: staff._id });
  assert.equal(listed.length, 0, 'must not appear in staff listings');
});

test('releasing the email lets the same address be reused', async () => {
  const { locs } = await buildCafe();
  const email = `reuse${uniq()}@test.com`;
  const first = await mkUser({ role: 'staff', email, assignedLocation: locs[0]._id });
  await softDeleteUsers([first._id], { actorId: superAdmin._id });

  // Would throw E11000 if the removed account still squatted on the address.
  const second = await mkUser({ role: 'staff', email, assignedLocation: locs[0]._id });
  assert.equal(second.email, email);
});

test('sessionVersion bumps so live tokens die immediately', async () => {
  const { locs } = await buildCafe();
  const u = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });
  const before = u.sessionVersion || 1;
  await softDeleteUsers([u._id], { actorId: superAdmin._id });
  const after = await User.findById(u._id);
  assert.ok(after.sessionVersion > before, 'outstanding tokens must be invalidated');
});

test('double soft delete does not double-namespace the email', async () => {
  const { locs } = await buildCafe();
  const email = `once${uniq()}@test.com`;
  const u = await mkUser({ role: 'staff', email, assignedLocation: locs[0]._id });
  await softDeleteUsers([u._id], { actorId: superAdmin._id });
  const firstPass = (await User.findById(u._id)).email;
  await softDeleteUsers([u._id], { actorId: superAdmin._id });
  const secondPass = (await User.findById(u._id)).email;
  assert.equal(firstPass, secondPass, 'idempotent');
  assert.equal((secondPass.match(/deleted\./g) || []).length, 1);
});

// ---------------------------------------------------------------------------
// Preserve invariant — the core guarantee
// ---------------------------------------------------------------------------

test('financial records are reported as preserved, never as cascade', async () => {
  const { cafe, locs } = await buildCafe();
  const staff = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });

  await Expense.create({
    title: 'Milk',
    description: 'Daily milk supply',
    proofImage: 'https://example.test/receipt.jpg',
    amount: 500,
    category: 'Supplies',
    date: new Date(),
    locationId: locs[0]._id,
    createdBy: staff._id,
  });
  await Payroll.create({
    user: staff._id,
    locationId: locs[0]._id,
    month: '2026-07',
    baseSalary: 20000,
    dailyRate: 645,
    payableDays: 31,
    netSalary: 20000,
  });

  const impact = await previewUserImpact(staff);

  const keys = impact.preserve.map((r) => r.key);
  assert.ok(keys.includes('expenses'), 'expenses reported under preserve');
  assert.ok(keys.includes('payroll'), 'payroll reported under preserve');
  assert.equal(impact.cascade.length, 0, 'a person cascades no records at all');
});

test('cafe purge destroys configuration but leaves money and audit rows intact', async () => {
  const { cafe, locs } = await buildCafe({ branches: 2 });
  const staff = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });
  const cat = await Category.create({ name: `Cat-${uniq()}`, createdBy: superAdmin._id });

  await Table.create({ locationId: locs[0]._id, tableNumber: 101, capacity: 4, createdBy: superAdmin._id });
  await Table.create({ locationId: locs[1]._id, tableNumber: 102, capacity: 4, createdBy: superAdmin._id });
  await MenuItem.create({
    name: `Only-${uniq()}`, price: 100, category: cat._id, createdBy: superAdmin._id,
    locationId: locs[0]._id, availableBranches: [locs[0]._id],
  });
  await Reservation.create({
    locationId: locs[0]._id, userId: staff._id, eventName: 'Birthday',
    reservationType: 'table', customerName: 'Guest', customerPhone: '9999999999',
    date: new Date(Date.now() + 864e5),
    startTime: '18:00', endTime: '20:00', guestCount: 6,
  });

  const expense = await Expense.create({
    title: 'Rent', description: 'Monthly rent', proofImage: 'https://example.test/rent.jpg',
    amount: 9000, category: 'Rent', date: new Date(),
    locationId: locs[0]._id, createdBy: staff._id,
  });
  const order = await Order.create({
    branch: locs[0]._id, orderType: 'takeaway', items: [],
    totalAmount: 250, createdBy: staff._id,
  });

  await executeCafePurge(cafe._id, { actorId: superAdmin._id, staffMode: 'detach' });

  assert.equal(await Table.countDocuments({ locationId: { $in: locs.map((l) => l._id) } }), 0, 'tables gone');
  assert.equal(await Reservation.countDocuments({ locationId: locs[0]._id }), 0, 'forward bookings gone');

  assert.ok(await Expense.findById(expense._id), 'EXPENSE MUST SURVIVE');
  assert.ok(await Order.findById(order._id), 'ORDER MUST SURVIVE');

  const cafeDoc = await Cafe.findById(cafe._id);
  assert.equal(cafeDoc.status, 'deleted');

  const branch = await Location.findById(locs[0]._id);
  assert.equal(branch.isPermanentlyDeleted, true, 'stage-2 branch delete actually ran');
});

test('branch purge keeps cafe-wide menu items and only unlinks the branch', async () => {
  const { locs } = await buildCafe({ branches: 2 });
  const cat = await Category.create({ name: `Cat-${uniq()}`, createdBy: superAdmin._id });

  const shared = await MenuItem.create({
    name: `Shared-${uniq()}`, price: 120, category: cat._id, createdBy: superAdmin._id,
    isGlobal: true, availableBranches: [locs[0]._id, locs[1]._id],
  });
  const branchOnly = await MenuItem.create({
    name: `Local-${uniq()}`, price: 80, category: cat._id, createdBy: superAdmin._id,
    locationId: locs[0]._id, availableBranches: [locs[0]._id],
  });

  await executeLocationPurge([locs[0]._id], { actorId: superAdmin._id });

  assert.equal(await MenuItem.findById(branchOnly._id), null, 'branch-only item removed');

  const survivor = await MenuItem.findById(shared._id);
  assert.ok(survivor, 'cafe-wide item must survive');
  assert.equal(survivor.availableBranches.length, 1, 'dead branch unlinked');
  assert.equal(String(survivor.availableBranches[0]), String(locs[1]._id), 'other branch keeps it');
});

// ---------------------------------------------------------------------------
// Subordinates and replacement
// ---------------------------------------------------------------------------

test('subordinates of a branch lead are its staff and chefs only', async () => {
  const { locs } = await buildCafe();
  const lead = await mkUser({ role: 'branch_admin', assignedLocation: locs[0]._id });
  await mkUser({ role: 'staff', assignedLocation: locs[0]._id });
  await mkUser({ role: 'chef', assignedLocation: locs[0]._id });
  const { locs: otherLocs } = await buildCafe();
  const elsewhere = await mkUser({ role: 'staff', assignedLocation: otherLocs[0]._id });

  const subs = await findSubordinates(lead);
  assert.equal(subs.length, 2, 'exactly the two under this branch');
  assert.ok(!subs.some((s) => String(s._id) === String(elsewhere._id)), 'other branches untouched');
});

test('already-removed people are not offered as replacements', async () => {
  const { locs } = await buildCafe();
  const lead = await mkUser({ role: 'branch_admin', assignedLocation: locs[0]._id });
  const live = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });
  const gone = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });
  await softDeleteUsers([gone._id], { actorId: superAdmin._id });

  const candidates = await findReplacementCandidates(lead);
  const ids = candidates.map((c) => String(c.id || c._id));
  assert.ok(ids.includes(String(live._id)), 'live staff offered');
  assert.ok(!ids.includes(String(gone._id)), 'removed staff must never be offered');
});

test('cascade removes the lead together with their team', async () => {
  const { locs } = await buildCafe();
  const lead = await mkUser({ role: 'branch_admin', assignedLocation: locs[0]._id });
  const a = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });
  const b = await mkUser({ role: 'chef', assignedLocation: locs[0]._id });

  const subs = await findSubordinates(lead);
  await softDeleteUsers(subs.map((s) => s._id), { actorId: superAdmin._id });
  await softDeleteUsers([lead._id], { actorId: superAdmin._id });

  for (const u of [lead, a, b]) {
    assert.ok((await User.findById(u._id)).deletedAt, `${u._id} removed`);
  }
});

// ---------------------------------------------------------------------------
// Cafe lockout
// ---------------------------------------------------------------------------

test('suspending a cafe locks out its branch staff', async () => {
  const { cafe, locs } = await buildCafe();
  const staff = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });

  assert.equal(await getSuspensionFor(staff), null, 'not locked while active');

  await Cafe.updateOne(
    { _id: cafe._id },
    { $set: { status: 'suspended', suspendedReason: 'unpaid invoice', suspendedAt: new Date() } }
  );
  invalidateTenantCache();

  const suspension = await getSuspensionFor(staff);
  assert.ok(suspension, 'branch staff are locked out via their branch cafe');
  assert.equal(suspension.reason, 'unpaid invoice', 'reason reaches the lock screen');
});

test('suspending a cafe locks out its admin too', async () => {
  const { cafe } = await buildCafe();
  const admin = await mkUser({ role: 'admin', cafes: [cafe._id] });

  await Cafe.updateOne({ _id: cafe._id }, { $set: { status: 'suspended' } });
  invalidateTenantCache();

  assert.ok(await getSuspensionFor(admin), 'the cafe owner is frozen as well');
});

test('a super admin is never locked out by a suspension', async () => {
  const { cafe } = await buildCafe();
  await Cafe.updateOne({ _id: cafe._id }, { $set: { status: 'suspended' } });
  invalidateTenantCache();

  assert.equal(
    await getSuspensionFor(superAdmin),
    null,
    'locking out the only account that can unblock would make it permanent'
  );
});

test('another cafe is unaffected by a suspension', async () => {
  const { cafe: blocked } = await buildCafe();
  const { locs: otherLocs } = await buildCafe();
  const bystander = await mkUser({ role: 'staff', assignedLocation: otherLocs[0]._id });

  await Cafe.updateOne({ _id: blocked._id }, { $set: { status: 'suspended' } });
  invalidateTenantCache();

  assert.equal(await getSuspensionFor(bystander), null, 'suspension is per tenant');
});

test('unsuspending restores access', async () => {
  const { cafe, locs } = await buildCafe();
  const staff = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });

  await Cafe.updateOne({ _id: cafe._id }, { $set: { status: 'suspended' } });
  invalidateTenantCache();
  assert.ok(await getSuspensionFor(staff));

  await Cafe.updateOne({ _id: cafe._id }, { $set: { status: 'active', suspendedReason: '' } });
  invalidateTenantCache();
  assert.equal(await getSuspensionFor(staff), null, 'access comes back');
});

test("'inactive' is not a lockout — only 'suspended' is", async () => {
  const { cafe, locs } = await buildCafe();
  const staff = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });

  await Cafe.updateOne({ _id: cafe._id }, { $set: { status: 'inactive' } });
  invalidateTenantCache();

  assert.equal(
    await getSuspensionFor(staff),
    null,
    'pre-existing inactive cafes must not be retroactively frozen'
  );
});

// ---------------------------------------------------------------------------
// Preview / execute agreement
// ---------------------------------------------------------------------------

test('preview counts match what the purge actually removes', async () => {
  const { cafe, locs } = await buildCafe({ branches: 1 });
  await Table.create({ locationId: locs[0]._id, tableNumber: 201, capacity: 2, createdBy: superAdmin._id });
  await Table.create({ locationId: locs[0]._id, tableNumber: 202, capacity: 2, createdBy: superAdmin._id });

  const before = await previewCafeImpact(cafe._id);
  const predictedTables = before.cascade.find((r) => r.key === 'tables')?.count || 0;
  assert.equal(predictedTables, 2, 'preview sees both tables');

  const result = await executeCafePurge(cafe._id, { actorId: superAdmin._id });
  const actualTables = result.performed.find((r) => r.key === 'tables')?.count || 0;
  assert.equal(actualTables, predictedTables, 'the dialog cannot lie about the outcome');
});

test('branch preview counts the people attached to it', async () => {
  const { locs } = await buildCafe();
  await mkUser({ role: 'staff', assignedLocation: locs[0]._id });
  await mkUser({ role: 'chef', assignedLocation: locs[0]._id });

  const impact = await previewLocationImpact([locs[0]._id]);
  assert.equal(impact.staffCount, 2);
});

test('detaching staff moves them to a surviving branch when they have one', async () => {
  const { locs } = await buildCafe({ branches: 2 });
  const staff = await mkUser({
    role: 'staff',
    assignedLocation: locs[0]._id,
    accessibleLocations: [locs[0]._id, locs[1]._id],
  });

  await executeLocationPurge([locs[0]._id], { actorId: superAdmin._id, staffMode: 'detach' });

  const fresh = await User.findById(staff._id);
  assert.ok(fresh, 'person survives');
  assert.equal(fresh.deletedAt, null, 'and is NOT removed');
  assert.equal(String(fresh.assignedLocation), String(locs[1]._id), 'moved to the surviving branch');
  assert.equal(fresh.accessibleLocations.length, 1, 'dead branch pulled from access list');
});

test('detaching the last branch leaves a valid, saveable document', async () => {
  const { locs } = await buildCafe();
  const staff = await mkUser({ role: 'staff', assignedLocation: locs[0]._id, accessibleLocations: [locs[0]._id] });

  await executeLocationPurge([locs[0]._id], { actorId: superAdmin._id, staffMode: 'detach' });

  const fresh = await User.findById(staff._id);
  assert.ok(fresh.assignedLocation, 'assignedLocation is REQUIRED for staff — must not be blanked');
  assert.equal(fresh.accessibleLocations.length, 0, 'dead branch pulled from access list');

  // The real regression guard: a nulled required field only bites later, on the
  // next ordinary save. This must not throw.
  fresh.phone = '9888888888';
  await fresh.save();
});

test('deleting staff on branch purge removes them', async () => {
  const { locs } = await buildCafe();
  const staff = await mkUser({ role: 'staff', assignedLocation: locs[0]._id });

  await executeLocationPurge([locs[0]._id], { actorId: superAdmin._id, staffMode: 'delete' });

  assert.ok((await User.findById(staff._id)).deletedAt, 'person removed with the branch');
});
