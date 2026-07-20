// Preview and execution for destructive super_admin operations.
//
// Both halves read the same registry (`dependencyGraph.js`), so the counts the
// confirmation dialog shows are produced by the very filters the delete then
// runs. A preview can drift from reality only if the data changes between the
// two calls — never because the two disagree about what a cascade means.
//
// Invariant enforced here and nowhere else: entries marked 'preserve' are
// counted and reported, but their `exec` is never invoked. There is no flag,
// including `force`, that turns a preserve into a delete.

const mongoose = require('mongoose');
const {
  LOCATION_DEPENDENTS,
  CAFE_DEPENDENTS,
  USER_DEPENDENTS,
  MODEL_FOR_KEY,
} = require('./dependencyGraph');

const M = (name) => mongoose.model(name);
const asArray = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean);

/**
 * Count every dependent for a set of root ids.
 * Returns rows shaped for direct rendering in the confirmation dialog.
 */
const countDependents = async (entries, ids) => {
  const roots = asArray(ids);
  if (!roots.length) return [];

  const rows = await Promise.all(
    entries.map(async (entry) => {
      const model = M(MODEL_FOR_KEY[entry.key]);
      const count = await model.countDocuments(entry.filter(roots));
      return {
        key: entry.key,
        label: entry.label,
        disposition: entry.disposition,
        count,
      };
    })
  );

  // Empty relationships are noise in a confirmation dialog.
  return rows.filter((r) => r.count > 0);
};

/**
 * Run every non-preserve entry. Preserve rows are skipped without ceremony —
 * they have no `exec` to call in the first place.
 */
const executeDependents = async (entries, ids, { skipKeys = [] } = {}) => {
  const roots = asArray(ids);
  const performed = [];
  if (!roots.length) return performed;

  for (const entry of entries) {
    if (entry.disposition === 'preserve') continue;
    if (!entry.exec) continue; // handled by the caller (e.g. nested branches)
    if (skipKeys.includes(entry.key)) continue;

    const res = await entry.exec(roots);
    const affected = res?.deletedCount ?? res?.modifiedCount ?? 0;
    if (affected > 0) {
      performed.push({ key: entry.key, label: entry.label, disposition: entry.disposition, count: affected });
    }
  }
  return performed;
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * The people who would be orphaned by removing this user: staff and chefs under
 * a branch lead, or every non-admin member of an admin's cafes. Super admins are
 * never included — they are not anybody's subordinate.
 */
const findSubordinates = async (user) => {
  const User = M('User');
  const base = { _id: { $ne: user._id }, role: { $ne: 'super_admin' }, deletedAt: null };

  if (user.role === 'admin') {
    const cafes = asArray(user.cafes);
    if (!cafes.length) return [];
    return User.find({ ...base, cafes: { $in: cafes } }).select('name role email assignedLocation').lean();
  }

  if (['branch_admin', 'location_admin'].includes(user.role)) {
    if (!user.assignedLocation) return [];
    return User.find({
      ...base,
      assignedLocation: user.assignedLocation,
      role: { $in: ['staff', 'chef'] },
    })
      .select('name role email assignedLocation')
      .lean();
  }

  return [];
};

/**
 * Users eligible to take over a departing role-holder's seat.
 *
 * Anyone already inside the same scope qualifies, including staff — taking the
 * seat promotes them. Filtering to existing same-role peers would leave most
 * branches with nobody to offer.
 */
const findReplacementCandidates = async (user) => {
  const User = M('User');
  const base = { _id: { $ne: user._id }, role: { $ne: 'super_admin' }, deletedAt: null, isBlocked: false };

  if (user.role === 'admin') {
    const cafes = asArray(user.cafes);
    if (!cafes.length) return [];
    return User.find({ ...base, $or: [{ cafes: { $in: cafes } }, { role: 'admin' }] })
      .select('name role email')
      .limit(200)
      .lean();
  }

  if (['branch_admin', 'location_admin'].includes(user.role)) {
    if (!user.assignedLocation) return [];
    return User.find({
      ...base,
      $or: [
        { assignedLocation: user.assignedLocation },
        { accessibleLocations: user.assignedLocation },
      ],
    })
      .select('name role email')
      .limit(200)
      .lean();
  }

  return [];
};

const previewUserImpact = async (user) => {
  const [rows, subordinates, candidates] = await Promise.all([
    countDependents(USER_DEPENDENTS, [user._id]),
    findSubordinates(user),
    findReplacementCandidates(user),
  ]);

  const isRoleHolder = ['admin', 'branch_admin', 'location_admin'].includes(user.role);

  return {
    subject: { type: 'user', id: String(user._id), name: user.name, role: user.role },
    // A role-holder's departure leaves a seat; the dialog offers to fill it.
    isRoleHolder,
    subordinates: subordinates.map((s) => ({ id: String(s._id), name: s.name, role: s.role })),
    replacementCandidates: candidates.map((c) => ({ id: String(c._id), name: c.name, role: c.role })),
    cascade: rows.filter((r) => r.disposition === 'cascade'),
    detach: rows.filter((r) => r.disposition === 'detach'),
    preserve: rows.filter((r) => r.disposition === 'preserve'),
  };
};

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

const locationUserFilter = (ids) => ({
  deletedAt: null,
  role: { $ne: 'super_admin' },
  $or: [{ assignedLocation: { $in: ids } }, { accessibleLocations: { $in: ids } }],
});

const previewLocationImpact = async (locationIds) => {
  const ids = asArray(locationIds);
  const [rows, staffCount] = await Promise.all([
    countDependents(LOCATION_DEPENDENTS, ids),
    M('User').countDocuments(locationUserFilter(ids)),
  ]);

  return {
    cascade: rows.filter((r) => r.disposition === 'cascade'),
    detach: rows.filter((r) => r.disposition === 'detach'),
    preserve: rows.filter((r) => r.disposition === 'preserve'),
    staffCount,
  };
};

/**
 * Permanently remove branches and everything that only exists because of them.
 * Financial history stays put and keeps pointing at the (now absent) branch id;
 * report screens resolve that to "Removed branch" rather than breaking.
 */
const executeLocationPurge = async (locationIds, { actorId, staffMode = 'detach' } = {}) => {
  const ids = asArray(locationIds);
  if (!ids.length) return { performed: [], staffAffected: 0 };

  const performed = await executeDependents(LOCATION_DEPENDENTS, ids);
  const staffAffected = await disposeLocationUsers(ids, { actorId, staffMode });

  // Stage 2 of the branch lifecycle, which the original two-stage design
  // declared but never implemented. The row itself is kept so historical
  // records can still resolve a branch name.
  await M('Location').updateMany(
    { _id: { $in: ids } },
    { $set: { status: 'deleted', isPermanentlyDeleted: true } }
  );

  return { performed, staffAffected };
};

/**
 * What happens to the people attached to a branch that is going away.
 *   'detach' — they survive; the dead branch is pulled from their access lists.
 *   'delete' — they are soft-deleted alongside it.
 */
const disposeLocationUsers = async (locationIds, { actorId, staffMode }) => {
  const ids = asArray(locationIds);
  const User = M('User');

  if (staffMode === 'delete') {
    const victims = await User.find(locationUserFilter(ids)).select('_id').lean();
    if (!victims.length) return 0;
    await softDeleteUsers(victims.map((v) => v._id), { actorId, reason: 'Branch removed' });
    return victims.length;
  }

  const res = await User.updateMany(
    { accessibleLocations: { $in: ids } },
    { $pull: { accessibleLocations: { $in: ids } } }
  );
  await User.updateMany(
    { assignedLocation: { $in: ids } },
    { $set: { assignedLocation: null } }
  );
  return res.modifiedCount || 0;
};

// ---------------------------------------------------------------------------
// Cafes
// ---------------------------------------------------------------------------

const liveBranchIds = async (cafeIds) => {
  const rows = await M('Location')
    .find({ cafe: { $in: asArray(cafeIds) }, isPermanentlyDeleted: { $ne: true } })
    .select('_id')
    .lean();
  return rows.map((r) => r._id);
};

const previewCafeImpact = async (cafeId) => {
  const branchIds = await liveBranchIds([cafeId]);

  const [cafeRows, branchImpact, adminCount] = await Promise.all([
    countDependents(CAFE_DEPENDENTS, [cafeId]),
    branchIds.length
      ? previewLocationImpact(branchIds)
      : Promise.resolve({ cascade: [], detach: [], preserve: [], staffCount: 0 }),
    M('User').countDocuments({ cafes: cafeId, deletedAt: null, role: { $ne: 'super_admin' } }),
  ]);

  // Roll the branch-level rows up into the cafe view so the dialog shows one
  // honest total per collection rather than a per-branch breakdown nobody reads.
  const merge = (a, b) => {
    const out = new Map();
    [...a, ...b].forEach((row) => {
      const prev = out.get(row.key);
      if (prev) prev.count += row.count;
      else out.set(row.key, { ...row });
    });
    return [...out.values()];
  };

  return {
    subject: { type: 'cafe', id: String(cafeId) },
    branchCount: branchIds.length,
    staffCount: branchImpact.staffCount,
    adminCount,
    cascade: merge(cafeRows.filter((r) => r.disposition === 'cascade'), branchImpact.cascade),
    detach: merge(cafeRows.filter((r) => r.disposition === 'detach'), branchImpact.detach),
    preserve: merge(cafeRows.filter((r) => r.disposition === 'preserve'), branchImpact.preserve),
  };
};

/**
 * Force-delete a cafe: its branches, their configuration, and optionally its
 * people. Money and audit rows survive by construction.
 */
const executeCafePurge = async (cafeId, { actorId, staffMode = 'detach' } = {}) => {
  const branchIds = await liveBranchIds([cafeId]);

  const branchResult = branchIds.length
    ? await executeLocationPurge(branchIds, { actorId, staffMode })
    : { performed: [], staffAffected: 0 };

  const performed = await executeDependents(CAFE_DEPENDENTS, [cafeId]);

  const User = M('User');
  if (staffMode === 'delete') {
    const admins = await User.find({ cafes: cafeId, deletedAt: null, role: { $ne: 'super_admin' } })
      .select('_id')
      .lean();
    if (admins.length) {
      await softDeleteUsers(admins.map((a) => a._id), { actorId, reason: 'Cafe removed' });
    }
  }
  // Always drop the membership, even when the person is kept: a live pointer to
  // a deleted cafe would keep granting access through `accessibleLocations`.
  await User.updateMany({ cafes: cafeId }, { $pull: { cafes: cafeId } });

  await M('Cafe').updateOne({ _id: cafeId }, { $set: { status: 'deleted' } });

  return {
    performed: [...branchResult.performed, ...performed],
    branchCount: branchIds.length,
    staffAffected: branchResult.staffAffected,
  };
};

// ---------------------------------------------------------------------------
// Soft delete primitive, shared by every path above
// ---------------------------------------------------------------------------

/**
 * Mark users as removed: invisible everywhere, unable to log in, live sockets
 * dropped — but still resolvable by every historical record that names them.
 *
 * Runs document-by-document rather than as one `updateMany` because each row
 * needs its own namespaced email (see `User.releaseEmail`).
 */
const softDeleteUsers = async (userIds, { actorId = null, reason = '' } = {}) => {
  const User = M('User');
  const ids = asArray(userIds);
  if (!ids.length) return 0;

  const users = await User.find({ _id: { $in: ids }, deletedAt: null });
  const now = new Date();

  for (const user of users) {
    user.releaseEmail();
    user.deletedAt = now;
    user.deletedBy = actorId;
    user.deletedReason = reason;
    user.isBlocked = true;
    user.active = false;
    // Kills every token already in the wild; the handshake mirror drops sockets.
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await user.save({ validateModifiedOnly: true });
  }

  try {
    const { disconnectUser } = require('../config/socket');
    users.forEach((u) => disconnectUser(u._id));
  } catch {
    // Socket layer is absent in tests and scripts; deletion must not depend on it.
  }

  return users.length;
};

module.exports = {
  countDependents,
  executeDependents,
  previewUserImpact,
  previewLocationImpact,
  previewCafeImpact,
  executeLocationPurge,
  executeCafePurge,
  softDeleteUsers,
  findSubordinates,
  findReplacementCandidates,
};
