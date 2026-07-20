// Tenant-level (cafe) lockout, evaluated on every authenticated request.
//
// Suspending a cafe has to freeze every one of its people immediately, which
// means the check runs on the hottest path in the application. Two things keep
// it cheap:
//
//   1. The suspended-cafe set is cached. In the normal case — nothing suspended
//      — a request costs one `Set.size` read and zero database work.
//   2. Only when something *is* suspended do we resolve which cafe the user
//      belongs to, and even then the branch→cafe mapping is cached, because
//      branches change far more slowly than requests arrive.
//
// Caches are short-lived and also invalidated directly by the suspend and
// unsuspend endpoints, so a lockout takes effect at once on the instance that
// performed it and within `SUSPENDED_TTL_MS` everywhere else.

const mongoose = require('mongoose');

const SUSPENDED_TTL_MS = 15 * 1000;
const LOCATION_TTL_MS = 60 * 1000;

let suspendedCache = { at: 0, byId: new Map() };
let locationCache = { at: 0, byId: new Map() };

const now = () => Date.now();

/** Cafes currently frozen, as id -> { name, reason, at }. */
const getSuspendedCafes = async () => {
  if (now() - suspendedCache.at < SUSPENDED_TTL_MS) return suspendedCache.byId;

  const rows = await mongoose
    .model('Cafe')
    .find({ status: 'suspended' })
    .select('name suspendedReason suspendedAt')
    .lean();

  const byId = new Map(
    rows.map((c) => [
      String(c._id),
      { name: c.name, reason: c.suspendedReason || '', at: c.suspendedAt || null },
    ])
  );
  suspendedCache = { at: now(), byId };
  return byId;
};

const getLocationCafeMap = async () => {
  if (now() - locationCache.at < LOCATION_TTL_MS) return locationCache.byId;

  const rows = await mongoose.model('Location').find({}).select('cafe').lean();
  const byId = new Map(rows.map((l) => [String(l._id), l.cafe ? String(l.cafe) : null]));
  locationCache = { at: now(), byId };
  return byId;
};

/** Drop both caches. Called by suspend/unsuspend and by cafe/branch deletion. */
const invalidateTenantCache = () => {
  suspendedCache = { at: 0, byId: new Map() };
  locationCache = { at: 0, byId: new Map() };
};

/**
 * Every cafe a user belongs to. Admins carry an explicit membership list;
 * branch-level roles derive theirs from the branch they are attached to.
 */
const resolveUserCafeIds = async (user) => {
  const ids = new Set();

  (user.cafes || []).forEach((c) => ids.add(String(c._id || c)));

  const branchIds = [
    user.assignedLocation,
    ...(user.accessibleLocations || []),
  ]
    .filter(Boolean)
    .map((l) => String(l._id || l));

  if (branchIds.length) {
    const map = await getLocationCafeMap();
    branchIds.forEach((b) => {
      const cafeId = map.get(b);
      if (cafeId) ids.add(cafeId);
    });
  }

  return [...ids];
};

/**
 * Returns suspension details when this user's cafe is frozen, else null.
 *
 * A super_admin is never frozen — they are the only one who can lift the
 * suspension, so locking them out would make it permanent.
 */
const getSuspensionFor = async (user) => {
  if (!user || user.role === 'super_admin') return null;

  const suspended = await getSuspendedCafes();
  if (!suspended.size) return null; // fast path

  const cafeIds = await resolveUserCafeIds(user);
  for (const id of cafeIds) {
    const info = suspended.get(id);
    if (info) return { cafeId: id, ...info };
  }
  return null;
};

module.exports = {
  getSuspendedCafes,
  getSuspensionFor,
  resolveUserCafeIds,
  invalidateTenantCache,
};
