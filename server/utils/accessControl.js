const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeId = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const userLocationIds = (user) => {
  if (!user) return [];
  const ids = [];
  if (user.assignedLocation) ids.push(normalizeId(user.assignedLocation));
  if (Array.isArray(user.accessibleLocations)) {
    user.accessibleLocations.forEach((loc) => ids.push(normalizeId(loc)));
  }
  return ids.filter(Boolean);
};

const canAccessLocation = (user, locationId) => {
  if (!user || !locationId) return false;
  if (user.role === 'super_admin') return true;
  const target = normalizeId(locationId);
  return userLocationIds(user).includes(target);
};

const enforceLocationAccess = (req, res, locationId, message = 'Access denied to this location') => {
  if (!canAccessLocation(req.user, locationId)) {
    res.status(403);
    throw new Error(message);
  }
};

const scopedLocationId = (req, requestedLocationId) => {
  if (req.user.role === 'super_admin') {
    return requestedLocationId && requestedLocationId !== 'all' ? requestedLocationId : null;
  }

  if (req.user.role === 'admin') {
    if (requestedLocationId && requestedLocationId !== 'all') {
      if (!canAccessLocation(req.user, requestedLocationId)) {
        const error = new Error('Access denied to this location');
        error.statusCode = 403;
        throw error;
      }
      return requestedLocationId;
    }
    return { $in: userLocationIds(req.user) };
  }

  return req.user.assignedLocation;
};

const clampLimit = (value, fallback = 20, max = 100) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

module.exports = {
  escapeRegex,
  normalizeId,
  userLocationIds,
  canAccessLocation,
  enforceLocationAccess,
  scopedLocationId,
  clampLimit,
};
