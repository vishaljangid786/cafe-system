// Startup migrations run once when the database connection is established.
//
// NOTE: a previous migration here reset EVERY user's password to a hardcoded
// testing value ("123456") on startup. That was destructive — it silently
// wiped real user passwords on each fresh deploy / fresh database — and has
// been removed. Add only real, idempotent, non-destructive migrations here.
const mongoose = require('mongoose');

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

const runStartupMigrations = async (connection) => {
  try {
    await backfillCafes();
  } catch (err) {
    // Never let a migration failure crash the server boot — log and continue.
    console.error('[migration] Cafe backfill failed (non-fatal):', err.message);
  }
};

module.exports = { runStartupMigrations };
