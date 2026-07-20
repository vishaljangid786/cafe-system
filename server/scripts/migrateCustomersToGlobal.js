/**
 * Customer migration: per-branch rows  ->  global identity + per-cafe memberships.
 *
 * The old model keyed a customer by { phone, branch }, so one human who visited
 * three branches existed as three documents with three separate loyalty balances.
 * The new model is one document per phone, with a `memberships[]` entry per cafe.
 *
 * This script:
 *   1. groups every Customer by NORMALIZED phone (digits only),
 *   2. elects the earliest-created document of each group as the survivor,
 *   3. folds every doc in the group into the survivor's memberships (branch -> cafe),
 *   4. sums the roll-ups (visits / totalSpend / loyaltyPoints), takes max(lastVisit)
 *      and merges the favoriteItems counters,
 *   5. deletes the losers,
 *   6. swaps the indexes: drop `phone_1_branch_1`, build the global unique `phone_1`.
 *
 * It is IDEMPOTENT — re-running once converged is a no-op — and supports `--dry-run`,
 * which prints the merge plan and writes nothing.
 *
 * Usage:
 *   node scripts/migrateCustomersToGlobal.js --dry-run
 *   node scripts/migrateCustomersToGlobal.js
 */

const mongoose = require('mongoose');
// Canonical normalization (strips the +91 country code / trunk 0) so the same
// human typed three different ways collapses into ONE identity.
const { normalizePhone } = require('../utils/phone');

const toId = (v) => (v && v._id ? v._id : v);
const idStr = (v) => (v ? String(toId(v)) : '');

/**
 * Build the merge plan and (unless dryRun) apply it.
 * Accepts an optional live connection so it can run inside startupMigrations.
 */
const migrateCustomersToGlobal = async ({ dryRun = false, connection = null, verbose = true } = {}) => {
  const db = connection?.db || mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  const existing = await db.listCollections({ name: 'customers' }).toArray();
  if (existing.length === 0) {
    if (verbose) console.log('[customer-migration] No customers collection — nothing to do.');
    return { skipped: true, reason: 'no-collection' };
  }

  const customers = db.collection('customers');
  const locations = db.collection('locations');

  const docs = await customers.find({}).toArray();
  if (docs.length === 0) {
    await ensureIndexes(customers, dryRun, verbose);
    return { skipped: true, reason: 'empty', merged: 0, deleted: 0 };
  }

  // branch -> cafe lookup (one pass, no N+1)
  const branchIds = [...new Set(docs.map((d) => idStr(d.branch)).filter(Boolean))];
  const locDocs = branchIds.length
    ? await locations
      .find({ _id: { $in: branchIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .project({ cafe: 1 })
      .toArray()
    : [];
  const branchToCafe = new Map(locDocs.map((l) => [String(l._id), l.cafe ? String(l.cafe) : null]));

  // Group by normalized phone
  const groups = new Map();
  for (const doc of docs) {
    const key = normalizePhone(doc.phone);
    if (!key) continue; // skip unusable rows rather than colliding them all under ''
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  const plan = [];
  for (const [phone, group] of groups) {
    // Earliest-created survives; ties broken by _id for determinism.
    const sorted = [...group].sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      if (at !== bt) return at - bt;
      return String(a._id).localeCompare(String(b._id));
    });
    const survivor = sorted[0];
    const losers = sorted.slice(1);

    // Start from any memberships the survivor already has (re-run safety).
    const membershipByCafe = new Map();
    for (const m of survivor.memberships || []) {
      const cafeKey = idStr(m.cafe);
      if (cafeKey) membershipByCafe.set(cafeKey, { ...m, branches: (m.branches || []).map(idStr) });
    }

    let visits = 0;
    let totalSpend = 0;
    let loyaltyPoints = 0;
    let lastVisit = null;
    const favorites = new Map();

    for (const doc of sorted) {
      visits += Number(doc.visits) || 0;
      totalSpend += Number(doc.totalSpend) || 0;
      loyaltyPoints += Number(doc.loyaltyPoints) || 0;
      const lv = doc.lastVisit ? new Date(doc.lastVisit) : null;
      if (lv && (!lastVisit || lv > lastVisit)) lastVisit = lv;

      for (const [item, count] of Object.entries(doc.favoriteItems || {})) {
        favorites.set(item, (favorites.get(item) || 0) + (Number(count) || 0));
      }

      const branchKey = idStr(doc.branch);
      const cafeKey = branchKey ? branchToCafe.get(branchKey) : null;
      if (!cafeKey) continue; // branch missing or cafe-less: roll-ups still counted above

      const docVisits = Number(doc.visits) || 0;
      const prev = membershipByCafe.get(cafeKey);
      if (!prev) {
        membershipByCafe.set(cafeKey, {
          cafe: cafeKey,
          // Anyone with a completed visit is already 'existing' at that cafe.
          status: docVisits > 0 ? 'existing' : 'new',
          branches: branchKey ? [branchKey] : [],
          firstBranch: branchKey || null,
          joinedAt: doc.createdAt || new Date(),
          firstOrderAt: docVisits > 0 ? (doc.lastVisit || doc.createdAt || null) : null,
          lastVisit: doc.lastVisit || null,
          orderCount: docVisits,
          totalSpend: Number(doc.totalSpend) || 0,
          loyaltyPoints: Number(doc.loyaltyPoints) || 0,
          // A customer with prior orders has already consumed any intro offer.
          newCustomerDiscountUsed: docVisits > 0,
        });
      } else {
        if (branchKey && !prev.branches.includes(branchKey)) prev.branches.push(branchKey);
        prev.orderCount = (Number(prev.orderCount) || 0) + docVisits;
        prev.totalSpend = (Number(prev.totalSpend) || 0) + (Number(doc.totalSpend) || 0);
        prev.loyaltyPoints = (Number(prev.loyaltyPoints) || 0) + (Number(doc.loyaltyPoints) || 0);
        if (docVisits > 0) {
          prev.status = 'existing';
          prev.newCustomerDiscountUsed = true;
          const cand = doc.lastVisit || doc.createdAt || null;
          if (cand && (!prev.firstOrderAt || new Date(cand) < new Date(prev.firstOrderAt))) {
            prev.firstOrderAt = cand;
          }
        }
        const dlv = doc.lastVisit ? new Date(doc.lastVisit) : null;
        if (dlv && (!prev.lastVisit || dlv > new Date(prev.lastVisit))) prev.lastVisit = doc.lastVisit;
        const dj = doc.createdAt ? new Date(doc.createdAt) : null;
        if (dj && (!prev.joinedAt || dj < new Date(prev.joinedAt))) prev.joinedAt = doc.createdAt;
      }
    }

    const memberships = [...membershipByCafe.values()].map((m) => ({
      ...m,
      cafe: new mongoose.Types.ObjectId(m.cafe),
      branches: [...new Set(m.branches.filter(Boolean))].map((b) => new mongoose.Types.ObjectId(b)),
      firstBranch: m.firstBranch ? new mongoose.Types.ObjectId(m.firstBranch) : null,
    }));

    plan.push({
      phone,
      survivorId: survivor._id,
      loserIds: losers.map((l) => l._id),
      memberships,
      rollups: {
        phone, // write the normalized form back
        visits,
        totalSpend,
        loyaltyPoints,
        lastVisit: lastVisit || survivor.lastVisit || null,
        favoriteItems: Object.fromEntries(favorites),
      },
    });
  }

  const dupPlans = plan.filter((p) => p.loserIds.length > 0);
  const needsMembership = plan.filter((p) => p.memberships.length > 0);

  if (verbose) {
    console.log(`[customer-migration] ${docs.length} rows -> ${plan.length} unique phones`);
    console.log(`[customer-migration] ${dupPlans.length} phones have duplicates to merge (${dupPlans.reduce((a, p) => a + p.loserIds.length, 0)} rows will be deleted)`);
    console.log(`[customer-migration] ${needsMembership.length} survivors will carry memberships`);
    if (dryRun) {
      for (const p of dupPlans.slice(0, 20)) {
        console.log(`   phone ${p.phone}: keep ${p.survivorId}, delete [${p.loserIds.join(', ')}], cafes=${p.memberships.length}, visits=${p.rollups.visits}, spend=${p.rollups.totalSpend}`);
      }
      if (dupPlans.length > 20) console.log(`   … and ${dupPlans.length - 20} more`);
    }
  }

  if (dryRun) {
    if (verbose) console.log('[customer-migration] DRY RUN — no writes performed.');
    return { dryRun: true, uniquePhones: plan.length, duplicateGroups: dupPlans.length };
  }

  let merged = 0;
  let deleted = 0;
  for (const p of plan) {
    await customers.updateOne(
      { _id: p.survivorId },
      { $set: { ...p.rollups, memberships: p.memberships } }
    );
    if (p.loserIds.length) {
      const res = await customers.deleteMany({ _id: { $in: p.loserIds } });
      deleted += res.deletedCount || 0;
    }
    merged += 1;
  }

  await ensureIndexes(customers, false, verbose);

  if (verbose) {
    console.log(`[customer-migration] Done. ${merged} survivors updated, ${deleted} duplicate rows removed.`);
  }
  return { merged, deleted, uniquePhones: plan.length };
};

/**
 * Swap the customer indexes to the global-identity shape. Safe to re-run.
 */
const ensureIndexes = async (customers, dryRun, verbose) => {
  if (dryRun) return;
  const indexes = await customers.indexes();
  const byName = new Map(indexes.map((i) => [i.name, i]));

  // The old per-branch uniqueness is exactly what we are replacing.
  if (byName.has('phone_1_branch_1')) {
    await customers.dropIndex('phone_1_branch_1');
    if (verbose) console.log('[customer-migration] dropped legacy phone_1_branch_1 index');
  }

  const phoneIdx = byName.get('phone_1');
  if (phoneIdx && !phoneIdx.unique) {
    await customers.dropIndex('phone_1');
    if (verbose) console.log('[customer-migration] dropped non-unique phone_1 to rebuild as unique');
  }

  await customers.createIndex({ phone: 1 }, { name: 'phone_1', unique: true });
  await customers.createIndex({ 'memberships.cafe': 1, 'memberships.status': 1 });
  await customers.createIndex({ 'memberships.branches': 1 });
  await customers.createIndex({ dobMonth: 1, dobDay: 1 });
};

/** True once every phone is unique and no legacy index remains. */
const isConverged = async (connection = null) => {
  const db = connection?.db || mongoose.connection.db;
  if (!db) return false;
  const existing = await db.listCollections({ name: 'customers' }).toArray();
  if (existing.length === 0) return true;
  const customers = db.collection('customers');

  const indexes = await customers.indexes();
  const byName = new Map(indexes.map((i) => [i.name, i]));
  if (byName.has('phone_1_branch_1')) return false;
  if (!byName.get('phone_1')?.unique) return false;

  const dup = await customers.aggregate([
    { $group: { _id: '$phone', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $limit: 1 },
  ]).toArray();
  if (dup.length > 0) return false;

  // Any pre-migration row still lacking memberships means we are not done.
  const missing = await customers.countDocuments({ memberships: { $exists: false } });
  return missing === 0;
};

module.exports = { migrateCustomersToGlobal, isConverged };

// ── CLI ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();
  const dryRun = process.argv.includes('--dry-run');
  (async () => {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`[customer-migration] connected (${dryRun ? 'DRY RUN' : 'LIVE'})`);
    await migrateCustomersToGlobal({ dryRun });
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => {
    console.error('[customer-migration] FAILED:', err);
    process.exit(1);
  });
}
