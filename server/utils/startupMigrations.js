// Startup migrations run once when the database connection is established.
//
// NOTE: a previous migration here reset EVERY user's password to a hardcoded
// testing value ("123456") on startup. That was destructive — it silently
// wiped real user passwords on each fresh deploy / fresh database — and has
// been removed. Add only real, idempotent, non-destructive migrations here.
const mongoose = require('mongoose');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Cafe backfill — introduces the Cafe (brand/organization) layer above branches.
//
// Strategy (chosen by the product owner): ONE CAFE PER EXISTING ADMIN. For each
// admin we create a cafe named after them and move the branches they administer
// (their accessibleLocations) under that cafe. Branches with no owning admin go
// to a single "Default Cafe". A consistency pass then makes overlapping admins
// co-admins of any cafe whose branch they can access, so nobody loses access.
//
// Fully idempotent: it no-ops the moment any Cafe already exists, and it only
// ADDS data (cafes + the `cafe` field on branches + `cafes` on users) — it never
// deletes or overwrites anything.
const backfillCafes = async () => {
  const Cafe = require('../models/Cafe');
  const User = require('../models/User');
  const Location = require('../models/Location');

  // Fast no-op once migrated.
  if ((await Cafe.countDocuments()) > 0) return;

  // Cross-instance lock: on serverless, several instances can boot at once and
  // each see 0 cafes. A unique-_id upsert is an atomic gate — only the instance
  // that INSERTS the lock proceeds; the rest see the existing doc and bail. This
  // prevents a duplicate set of cafes from a concurrent double-run.
  const db = require('mongoose').connection.db;
  if (db) {
    try {
      const prior = await db.collection('migrations').findOneAndUpdate(
        { _id: 'cafe-backfill' },
        { $setOnInsert: { startedAt: new Date() } },
        { upsert: true, returnDocument: 'before' }
      );
      // findOneAndUpdate returns the pre-existing doc (or null when we inserted).
      const existed = prior && (prior.value !== undefined ? prior.value : prior);
      if (existed) return; // another instance already claimed it
    } catch (e) {
      // A concurrent upsert on the unique _id can make the race-loser throw a
      // duplicate-key error instead of matching the existing doc — that means
      // another instance won, so BAIL (don't double-run the backfill).
      if (e && (e.code === 11000 || e.code === 11001)) return;
      // Any other error (e.g. lock collection unavailable) → fall through; the
      // countDocuments guard above still prevents re-runs single-instance.
    }
  }

  const locations = await Location.find({ isPermanentlyDeleted: { $ne: true } })
    .select('_id cafe city state').lean();
  if (locations.length === 0) return; // fresh DB, nothing to backfill

  const superAdmin = await User.findOne({ role: 'super_admin' }).select('_id').lean();
  const admins = await User.find({ role: 'admin' })
    .select('_id name email accessibleLocations city state').lean();

  const usedNames = new Set();
  const uniqueName = (base) => {
    let name = base;
    let n = 2;
    while (usedNames.has(name.toLowerCase())) name = `${base} (${n++})`;
    usedNames.add(name.toLowerCase());
    return name;
  };

  const branchCafe = new Map(); // branchId -> cafeId
  const adminCafe = new Map(); // adminId -> cafeId

  // 1. One cafe per admin; each branch claimed by its first owning admin.
  for (const admin of admins) {
    const cafe = await Cafe.create({
      name: uniqueName(`${admin.name}'s Cafe`),
      createdBy: superAdmin?._id || admin._id,
      address: { city: admin.city || '', state: admin.state || '' },
      contact: { email: admin.email || '' },
    });
    adminCafe.set(admin._id.toString(), cafe._id);
    await User.updateOne({ _id: admin._id }, { $addToSet: { cafes: cafe._id } });

    for (const branchId of admin.accessibleLocations || []) {
      const key = branchId.toString();
      if (!branchCafe.has(key)) branchCafe.set(key, cafe._id);
    }
  }

  // 2. Orphan branches (no owning admin) → a single Default Cafe.
  const orphans = locations.filter((l) => !l.cafe && !branchCafe.has(l._id.toString()));
  if (orphans.length > 0) {
    const defaultCafe = await Cafe.create({
      name: uniqueName('Default Cafe'),
      createdBy: superAdmin?._id || admins[0]?._id,
    });
    orphans.forEach((l) => branchCafe.set(l._id.toString(), defaultCafe._id));
  }

  // 3. Persist branch.cafe (only where not already set).
  const ops = [];
  for (const loc of locations) {
    if (loc.cafe) continue;
    const cafeId = branchCafe.get(loc._id.toString());
    if (cafeId) ops.push({ updateOne: { filter: { _id: loc._id }, update: { $set: { cafe: cafeId } } } });
  }
  if (ops.length) await Location.bulkWrite(ops);

  // 4. Consistency pass: every admin becomes a co-admin of each cafe whose branch
  //    they can access (handles branches shared across admins). accessibleLocations
  //    already grants the branch access — this just records the cafe membership.
  for (const admin of admins) {
    const cafeIds = new Set();
    for (const branchId of admin.accessibleLocations || []) {
      const cid = branchCafe.get(branchId.toString());
      if (cid) cafeIds.add(cid.toString());
    }
    const own = adminCafe.get(admin._id.toString());
    if (own) cafeIds.add(own.toString());
    if (cafeIds.size) {
      await User.updateOne(
        { _id: admin._id },
        { $addToSet: { cafes: { $each: [...cafeIds].map((id) => new mongoose.Types.ObjectId(id)) } } }
      );
    }
  }

  if (db) {
    try {
      await db.collection('migrations').updateOne(
        { _id: 'cafe-backfill' },
        { $set: { completedAt: new Date() } }
      );
    } catch (e) { /* observability only */ }
  }

  console.log(
    `[migration] Cafe backfill complete: ${adminCafe.size} admin cafe(s)` +
      `${orphans.length ? ' + 1 default cafe' : ''}, ${ops.length} branch(es) assigned.`
  );
};

// Auto-seeds demo data when the database is completely empty (first deploy / fresh DB).
// Runs AT MOST ONCE for the lifetime of a database:
//   1. Fast path — skips immediately if any User document already exists, so a
//      restart against a seeded DB never re-seeds (your data is never wiped).
//   2. Cross-instance lock — an atomic upsert on the `migrations` collection means
//      that when several instances cold-start against the same empty DB at once
//      (e.g. serverless on Vercel), only the one that INSERTS the lock seeds; the
//      rest bail. Without this, concurrent boots could each see 0 users and seed
//      in parallel, producing duplicate data.
const bootstrapSeedIfEmpty = async () => {
  // The seed provisions accounts whose credentials live in the repo, so an
  // accidental run against production would hand out a super_admin. In production
  // it therefore requires an EXPLICIT opt-in (SEED_MOONLIGHT=true) and can never
  // fire by itself on a fresh prod deploy; otherwise production creates its first
  // account through the initial-setup registration flow (registerUser makes the
  // very first user a super_admin — see authController).
  if (process.env.NODE_ENV === 'production') {
    if (String(process.env.SEED_MOONLIGHT).toLowerCase() !== 'true') return;
    console.warn('[startup] SEED_MOONLIGHT=true in PRODUCTION — seeding known credentials. Change every seeded password immediately after first login.');
  }

  const User = require('../models/User');
  const count = await User.estimatedDocumentCount();
  if (count > 0) return; // already has data — never re-seed

  const db = mongoose.connection.db;
  if (db) {
    try {
      const prior = await db.collection('migrations').findOneAndUpdate(
        { _id: 'demo-seed' },
        { $setOnInsert: { startedAt: new Date() } },
        { upsert: true, returnDocument: 'before' }
      );
      // findOneAndUpdate returns the pre-existing doc (or null when we inserted).
      const existed = prior && (prior.value !== undefined ? prior.value : prior);
      if (existed) return; // another instance already claimed/ran the seed
    } catch (e) {
      // A concurrent upsert on the unique _id can make the race-loser throw a
      // duplicate-key error instead of matching the existing doc — that means
      // another instance won the lock, so BAIL (don't double-seed).
      if (e && (e.code === 11000 || e.code === 11001)) return;
      // Any other lock error → fall through; the count guard above still
      // prevents re-runs on a single instance.
    }
  }

  console.log('[startup] Empty database detected — seeding Moon Light Cafe...');
  try {
    const { seedMoonlightCafe } = require('../seed/moonlightCafe');
    await seedMoonlightCafe();
    if (db) {
      try {
        await db.collection('migrations').updateOne(
          { _id: 'demo-seed' },
          { $set: { completedAt: new Date() } }
        );
      } catch (e) { /* observability only */ }
    }
    console.log('[startup] Moon Light Cafe seed complete.');
  } catch (err) {
    console.error('[startup] Moon Light Cafe seed failed (non-fatal):', err.message);
    // Seed failed and the DB is still empty — release the lock so the next boot
    // can retry instead of being permanently blocked by a half-finished marker.
    if (db) {
      try {
        await db.collection('migrations').deleteOne({ _id: 'demo-seed', completedAt: { $exists: false } });
      } catch (e) { /* best effort */ }
    }
  }
};

// DESTRUCTIVE: wipes EVERY seeded collection and rebuilds the full demo dataset
// from scratch. Gated behind the RESEED_ON_START env flag so it only ever runs
// when you explicitly opt in (it is unset in production, so a deploy can never
// nuke a live database). seedData() itself drops all collections before
// inserting, so this is just "run the seed unconditionally".
const reseedAll = async () => {
  if (process.env.NODE_ENV === 'production') {
    // HARD STOP: never wipe a production database off a stray RESEED_ON_START env
    // var. seedData() drops every collection, and this runs on each serverless cold
    // start — one leftover flag would nuke live data on the next deploy. Require a
    // separate, explicit confirmation token to override; otherwise skip loudly.
    if (process.env.RESEED_CONFIRM_PRODUCTION !== 'I_UNDERSTAND_THIS_WIPES_PROD') {
      console.error('[startup] ⛔ RESEED_ON_START=true in PRODUCTION was IGNORED — refusing to wipe the live database. To intentionally reseed prod, also set RESEED_CONFIRM_PRODUCTION="I_UNDERSTAND_THIS_WIPES_PROD".');
      return;
    }
    console.warn('[startup] ⚠ RESEED confirmed in PRODUCTION — wiping and reseeding the LIVE database!');
  }
  console.log('[startup] RESEED_ON_START=true — wiping all data and reseeding from scratch...');
  // Wipe first, then rebuild the ONLY dataset this project seeds. seedMoonlightCafe
  // itself is additive, so the drop lives here where the destructive intent is explicit.
  const { dropAllData } = require('../seed/moonlightCafe');
  const { seedMoonlightCafe } = require('../seed/moonlightCafe');
  await dropAllData();
  await seedMoonlightCafe();
  console.log('[startup] Reseed complete.');
};

const reseedEnabled = () => String(process.env.RESEED_ON_START).toLowerCase() === 'true';

// ---------------------------------------------------------------------------
// Payroll ledger backfill — every PAID payroll must have a matching EXPENSE
// Transaction. approvePayroll posts one for net-new approvals (and stamps
// ledgerExpenseId), but seed data and any payroll marked PAID before that sync
// existed have NO ledger entry. The P&L analytics source salary cost from the
// ledger (Transaction), so those paid salaries would be UNDER-counted, overstating
// profit. This backfills the missing Expense + synced Transaction so historical
// totals stay whole.
//
// Fully idempotent: only touches PAID payrolls whose ledgerExpenseId is unset, and
// stamps each one as it posts. Non-destructive: it only ADDS the missing records.
const backfillPayrollLedger = async () => {
  const Payroll = require('../models/Payroll');
  const Expense = require('../models/Expense');
  const User = require('../models/User');
  const TransactionService = require('../services/transactionService');

  // { ledgerExpenseId: null } matches both null AND a missing field (seed inserts
  // omit the field entirely), so this captures every un-posted paid payroll.
  const orphans = await Payroll.find({ status: 'PAID', ledgerExpenseId: null })
    .populate('user', 'name role assignedLocation')
    .lean();
  if (orphans.length === 0) return;

  const superAdmin = await User.findOne({ role: 'super_admin' }).select('_id').lean();
  let posted = 0;
  for (const payroll of orphans) {
    // Salary cost is booked against the staff member's branch; skip (and leave for a
    // later re-run) any payroll whose user/branch can't be resolved.
    if (!payroll.user || !payroll.user.assignedLocation) continue;
    const [year, mon] = String(payroll.month || '').split('-');
    const expenseDate = (year && mon) ? new Date(Number(year), Number(mon) - 1, 28) : new Date();
    const expense = await Expense.create({
      title: `Salary — ${payroll.user.name} (${payroll.month})`,
      description: `Payroll for ${payroll.user.name} (${payroll.user.role}) — ${payroll.payableDays} payable days (ledger backfill)`,
      amount: Number(payroll.netSalary) || 0,
      type: 'EXPENSE',
      category: 'Salary',
      status: 'approved',
      date: expenseDate,
      locationId: payroll.user.assignedLocation,
      createdBy: superAdmin?._id || payroll.user._id,
      proofImage: 'payroll-auto',
    });
    await TransactionService.syncExpenseToTransaction(expense);
    await Payroll.updateOne({ _id: payroll._id }, { $set: { ledgerExpenseId: expense._id } });
    posted++;
  }
  if (posted) console.log(`[migration] Payroll ledger backfill: posted ${posted} missing salary expense(s).`);
};

// ---------------------------------------------------------------------------
// allowedPages backfill — seeds User.allowedPages (the new page-level access list)
// for users created before it existed, derived from their OLD coarse `permissions`
// so their visible pages don't change. super_admin ignores the field. Idempotent:
// only touches users whose allowedPages is unset/empty, and never widens beyond
// what their legacy permissions already granted.
const backfillAllowedPages = async () => {
  const User = require('../models/User');
  const { pagesFromPermissions } = require('./pageAccess');

  const users = await User.find({
    role: { $ne: 'super_admin' },
    $or: [{ allowedPages: { $exists: false } }, { allowedPages: { $size: 0 } }],
  }).select('role permissions').lean();
  if (users.length === 0) return;

  const ops = [];
  for (const u of users) {
    const pages = pagesFromPermissions(u.permissions || {});
    if (pages.length) {
      ops.push({ updateOne: { filter: { _id: u._id }, update: { $set: { allowedPages: pages } } } });
    }
  }
  if (ops.length) {
    await User.bulkWrite(ops);
    console.log(`[migration] allowedPages backfill: seeded pages for ${ops.length} user(s).`);
  }
};

// ---------------------------------------------------------------------------
// Customer phone uniqueness moved from global phone-only to per-branch. Without
// dropping the old unique index, MongoDB would still reject the same customer
// phone ordering at two different branches even after the schema changed.
// Customers moved from per-branch rows ({ phone, branch } unique) to a single
// global identity per phone with per-cafe `memberships[]`. This REPLACES the old
// migrateCustomerPhoneIndex, which rebuilt the per-branch index on every boot and
// would now tear down the global identity index. The heavy lifting (merging
// duplicates, folding roll-ups, swapping indexes) lives in the standalone script
// so it can also be run manually with --dry-run.
// Settings gained a cafe tier, so uniqueness moved from { locationId } to
// { locationId, cafeId }. The old single-field unique index must be dropped or it
// blocks every cafe-tier document after the first (they all share locationId:null).
const migrateSettingsCafeIndex = async (connection) => {
  const db = connection?.db || mongoose.connection.db;
  if (!db) return;
  const exists = await db.listCollections({ name: 'settings' }).toArray();
  if (exists.length === 0) return;

  const collection = db.collection('settings');
  const indexes = await collection.indexes();
  const legacy = indexes.find((idx) => idx.name === 'locationId_1' && idx.unique);
  if (legacy) {
    await collection.dropIndex('locationId_1');
    console.log('[migration] Settings: dropped legacy unique locationId_1 index (cafe tier added).');
  }
  await collection.createIndex({ locationId: 1, cafeId: 1 }, { name: 'locationId_1_cafeId_1', unique: true });
};

// The cafe name index is partial, covering only "live" statuses. Adding
// 'suspended' changed that filter, and MongoDB will not alter a partial index in
// place — without dropping it first, a suspended cafe would fall outside the
// index and its name could be taken by a new cafe while it is merely blocked.
const migrateCafeNameIndex = async (connection) => {
  const db = connection?.db || mongoose.connection.db;
  if (!db) return;
  const exists = await db.listCollections({ name: 'cafes' }).toArray();
  if (exists.length === 0) return;

  const collection = db.collection('cafes');
  const indexes = await collection.indexes();
  const current = indexes.find((idx) => idx.name === 'name_1');

  const wanted = ['active', 'inactive', 'suspended'];
  const have = current?.partialFilterExpression?.status?.$in || [];
  const upToDate = have.length === wanted.length && wanted.every((s) => have.includes(s));
  if (current && upToDate) return;

  if (current) {
    await collection.dropIndex('name_1');
    console.log('[migration] Cafe: dropped name_1 to widen its partial filter for suspended cafes.');
  }
  await collection.createIndex(
    { name: 1 },
    { name: 'name_1', unique: true, partialFilterExpression: { status: { $in: wanted } } }
  );
};

const migrateCustomersToGlobalIdentity = async (connection) => {
  const { migrateCustomersToGlobal, isConverged } = require('../scripts/migrateCustomersToGlobal');
  if (await isConverged(connection)) return; // already migrated — no-op
  await migrateCustomersToGlobal({ connection, dryRun: false, verbose: true });
};

const backfillTablePublicOrderTokens = async () => {
  const Table = require('../models/Table');
  const tables = await Table.find({
    $or: [
      { publicOrderToken: { $exists: false } },
      { publicOrderToken: '' },
      { publicOrderToken: null },
    ],
  }).select('_id').lean();
  if (tables.length === 0) return;

  const ops = tables.map((table) => ({
    updateOne: {
      filter: { _id: table._id },
      update: { $set: { publicOrderToken: crypto.randomBytes(16).toString('hex') } },
    },
  }));
  await Table.bulkWrite(ops);
  console.log(`[migration] Table QR tokens: backfilled ${ops.length} table token(s).`);
};

const runStartupMigrations = async (connection) => {
  try {
    if (reseedEnabled()) {
      // Every connect: blow away all data and rebuild the demo dataset.
      await reseedAll();
    } else {
      // Default: seed exactly once, only when the database is empty.
      await bootstrapSeedIfEmpty();
    }
  } catch (err) {
    console.error('[startup] Seed step failed (non-fatal):', err.message);
  }
  try {
    await backfillCafes();
  } catch (err) {
    // Never let a migration failure crash the server boot — log and continue.
    console.error('[migration] Cafe backfill failed (non-fatal):', err.message);
  }
  try {
    await backfillPayrollLedger();
  } catch (err) {
    console.error('[migration] Payroll ledger backfill failed (non-fatal):', err.message);
  }
  try {
    await backfillAllowedPages();
  } catch (err) {
    console.error('[migration] allowedPages backfill failed (non-fatal):', err.message);
  }
  try {
    await migrateSettingsCafeIndex(connection);
  } catch (err) {
    console.error('[migration] Settings cafe-tier index migration failed (non-fatal):', err.message);
  }
  try {
    await migrateCafeNameIndex(connection);
  } catch (err) {
    console.error('[migration] Cafe name index migration failed (non-fatal):', err.message);
  }
  try {
    await migrateCustomersToGlobalIdentity(connection);
  } catch (err) {
    console.error('[migration] Customer global-identity migration failed (non-fatal):', err.message);
  }
  try {
    await backfillTablePublicOrderTokens();
  } catch (err) {
    console.error('[migration] Table QR token backfill failed (non-fatal):', err.message);
  }
};

module.exports = { runStartupMigrations };
