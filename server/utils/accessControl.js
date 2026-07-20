const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const endOfDay = (dateStr) => {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
};

const normalizeId = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const normalizeIdList = (value) => {
  if (!value) return [];
  const values = Array.isArray(value)
    ? value
    : value._id
      ? [value]
    : String(value).split(',');

  return [...new Set(values
    .map((item) => normalizeId(item).trim())
    .filter(Boolean)
    .filter((item) => !['all', 'global', 'undefined', 'null'].includes(item.toLowerCase()))
  )];
};

const isAllLocation = (value) => {
  if (!value) return true;
  const text = String(value).trim().toLowerCase();
  return ['all', 'global', 'undefined', 'null'].includes(text);
};

const userLocationIds = (user) => {
  if (!user) return [];
  const ids = [];
  if (user.assignedLocation) ids.push(normalizeId(user.assignedLocation));
  if (Array.isArray(user.accessibleLocations)) {
    user.accessibleLocations.forEach((loc) => ids.push(normalizeId(loc)));
  }
  return [...new Set(ids.filter(Boolean))];
};

const canAccessLocation = (user, locationId) => {
  if (!user || !locationId) return false;
  if (user.role === 'super_admin') return true;
  const target = normalizeId(locationId);
  return userLocationIds(user).includes(target);
};

const enforceLocationAccess = (req, res, locationId, message = 'Permission denied to this location') => {
  if (!canAccessLocation(req.user, locationId)) {
    res.status(403);
    throw new Error(message);
  }
};

const scopedLocationId = (req, requestedLocationId) => {
  if (req.user.role === 'super_admin') {
    return !isAllLocation(requestedLocationId) ? requestedLocationId : null;
  }

  if (req.user.role === 'admin' || req.user.role === 'branch_admin') {
    if (!isAllLocation(requestedLocationId)) {
      if (!canAccessLocation(req.user, requestedLocationId)) {
        const error = new Error('Permission denied to this location');
        error.statusCode = 403;
        throw error;
      }
      return requestedLocationId;
    }
    return { $in: userLocationIds(req.user) };
  }

  return req.user.assignedLocation || { $in: [] };
};

/**
 * Handles multi-branch scoping from a comma-separated `locationIds` query param.
 * Validates every ID against the user's access, then returns a Mongoose { $in: [...] } filter.
 * Returns null for super_admin/all, otherwise a scoped { $in: [...] } filter for all allowed branches.
 */
const scopedLocationIds = (req, rawLocationIds) => {
  if (!rawLocationIds || isAllLocation(rawLocationIds)) {
    if (req.user.role === 'super_admin') return null;
    return { $in: userLocationIds(req.user) };
  }

  const ids = normalizeIdList(rawLocationIds);
  if (ids.length === 0) return null;

  // Validate access for every requested ID
  const unauthorized = ids.filter(id => !canAccessLocation(req.user, id));
  if (unauthorized.length > 0) {
    const error = new Error('Permission denied to one or more requested locations');
    error.statusCode = 403;
    throw error;
  }

  return { $in: ids };
};

// Ensure every branch assigned to a Branch Admin belongs to a SINGLE admin.
// A branch "belongs to" the admin(s) who have it in their accessibleLocations.
// Throws a 400 if the chosen branches span more than one admin (or none owns
// all of them). A single branch is always allowed.
const assertBranchesUnderOneAdmin = async (branchIds) => {
  const User = require('../models/User');
  const ids = normalizeIdList(branchIds);
  if (ids.length <= 1) return;
  const admins = await User.find({ role: 'admin', accessibleLocations: { $in: ids }, deletedAt: null })
    .select('accessibleLocations')
    .lean();
  const ownedByOneAdmin = admins.some((a) => {
    const owned = new Set((a.accessibleLocations || []).map((x) => x.toString()));
    return ids.every((id) => owned.has(id));
  });
  if (!ownedByOneAdmin) {
    const err = new Error('These branches belong to different admins. A branch admin can only manage branches under a single admin.');
    err.statusCode = 400;
    throw err;
  }
};

const clampLimit = (value, fallback = 20, max = 100) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

module.exports = {
  escapeRegex,
  endOfDay,
  normalizeId,
  normalizeIdList,
  isAllLocation,
  userLocationIds,
  canAccessLocation,
  enforceLocationAccess,
  scopedLocationId,
  scopedLocationIds,
  assertBranchesUnderOneAdmin,
  clampLimit,
};
