// Keeps the cafe ↔ admin ↔ branch relationships consistent.
//
// The whole app scopes data by BRANCH (User.accessibleLocations / assignedLocation).
// Rather than rewrite every query to understand cafes, we keep a cafe's branch set
// MIRRORED into the accessibleLocations of all that cafe's admins. So "cafe access"
// is expressed through the same accessibleLocations that already power scoping —
// nothing downstream has to change.
const User = require('../models/User');
const Location = require('../models/Location');

const branchIdsForCafe = async (cafeId) => {
  const branches = await Location.find({
    cafe: cafeId,
    isPermanentlyDeleted: { $ne: true },
  }).select('_id').lean();
  return branches.map((b) => b._id);
};

const adminIdsForCafe = async (cafeId) => {
  const admins = await User.find({ role: 'admin', cafes: cafeId }).select('_id').lean();
  return admins.map((a) => a._id);
};

// Give every admin of the cafe access to every (current) branch of the cafe.
const syncCafeAccess = async (cafeId) => {
  const [branchIds, adminIds] = await Promise.all([
    branchIdsForCafe(cafeId),
    adminIdsForCafe(cafeId),
  ]);
  if (adminIds.length === 0 || branchIds.length === 0) return;
  await User.updateMany(
    { _id: { $in: adminIds } },
    { $addToSet: { accessibleLocations: { $each: branchIds } } }
  );
};

// When a single branch is added to a cafe, grant the cafe's admins access to it.
const grantBranchToCafeAdmins = async (cafeId, branchId) => {
  if (!cafeId) return;
  const adminIds = await adminIdsForCafe(cafeId);
  if (adminIds.length === 0) return;
  await User.updateMany(
    { _id: { $in: adminIds } },
    { $addToSet: { accessibleLocations: branchId } }
  );
};

// Add an admin to a cafe: record the membership AND grant access to its branches.
const addAdminToCafe = async (cafeId, userId) => {
  const branchIds = await branchIdsForCafe(cafeId);
  const add = { cafes: cafeId };
  if (branchIds.length) add.accessibleLocations = { $each: branchIds };
  await User.updateOne({ _id: userId }, { $addToSet: add });
};

// Remove an admin from a cafe: drop the membership and revoke access to its
// branches — but KEEP any branch that also belongs to another cafe the admin
// still administers, so multi-cafe admins don't lose unrelated access.
const removeAdminFromCafe = async (cafeId, userId) => {
  const user = await User.findById(userId).select('cafes');
  if (!user) return;

  const remainingCafes = (user.cafes || []).filter(
    (c) => c.toString() !== cafeId.toString()
  );

  const keep = new Set();
  if (remainingCafes.length) {
    const kept = await Location.find({ cafe: { $in: remainingCafes } })
      .select('_id').lean();
    kept.forEach((b) => keep.add(b._id.toString()));
  }

  const cafeBranches = await branchIdsForCafe(cafeId);
  const toRevoke = cafeBranches
    .map((b) => b.toString())
    .filter((b) => !keep.has(b));

  const pull = { cafes: cafeId };
  if (toRevoke.length) pull.accessibleLocations = { $in: toRevoke };
  await User.updateOne({ _id: userId }, { $pull: pull });
};

module.exports = {
  branchIdsForCafe,
  adminIdsForCafe,
  syncCafeAccess,
  grantBranchToCafeAdmins,
  addAdminToCafe,
  removeAdminFromCafe,
};
