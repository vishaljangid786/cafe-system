const Location = require('../models/Location');
const User = require('../models/User');
const Cafe = require('../models/Cafe');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { logActivity } = require('../utils/auditLogger');
const mongoose = require('mongoose');
const { userLocationIds } = require('../utils/accessControl');
const { grantBranchToCafeAdmins } = require('../utils/cafeSync');

// @desc    Get all locations
// @route   GET /api/locations
// @access  Private
const getLocations = asyncHandler(async (req, res) => {
  const { status, city, cafeId } = req.query;

  let query = { isPermanentlyDeleted: false };
  // Branches use a two-stage delete: status 'deleted' (soft) then
  // isPermanentlyDeleted. Filtering only on the latter left soft-deleted branches
  // showing up in every listing and downstream analytics. Hide them by default,
  // while still honouring an explicit ?status=deleted request.
  if (status) query.status = status;
  else query.status = { $ne: 'deleted' };
  if (city) query.city = city;

  // Filter based on user access
  if (req.user) {
    const role = req.user.role;
    if (['branch_admin', 'staff', 'chef', 'location_admin'].includes(role)) {
      const ids = role === 'branch_admin' ? userLocationIds(req.user) : userLocationIds(req.user).slice(0, 1);
      query._id = { $in: ids.length > 0 ? ids : [new mongoose.Types.ObjectId()] };
    } else if (role === 'admin') {
      // Always scope to accessible locations; empty array yields nothing
      const ids = userLocationIds(req.user);
      query._id = { $in: ids.length > 0 ? ids : [new mongoose.Types.ObjectId()] };
    }
    // super_admin: no filter — can see all
  }

  // Optional cafe filter (the super-admin cafe view, or an admin focusing one of
  // their cafes). Combined with the access scope above via $and so it can only
  // narrow what the user is already allowed to see.
  if (cafeId && mongoose.isValidObjectId(cafeId)) {
    query.cafe = new mongoose.Types.ObjectId(cafeId);
  }

  // 1. Fetch Locations
  const locations = await Location.find(query)
    .populate('createdBy', 'name email deletedAt')
    .populate('cafe', 'name logo')
    .lean();

  // 2. Fetch Staff Counts for these locations
  const locationIds = locations.map(l => l._id);
  const personnelCounts = await User.aggregate([
    {
      $match: {
        assignedLocation: { $in: locationIds },
        deletedAt: null
      }
    },
    {
      $group: {
        _id: '$assignedLocation',
        count: { $sum: 1 }
      }
    }
  ]);

  // 3. Map counts to locations
  const countMap = personnelCounts.reduce((acc, curr) => {
    acc[curr._id.toString()] = curr.count;
    return acc;
  }, {});

  const data = locations.map(loc => ({
    ...loc,
    personnelCount: countMap[loc._id.toString()] || 0
  }));

  res.json({
    success: true,
    count: data.length,
    data: data,
  });
});

// @desc    Create a location
// @route   POST /api/locations
// @access  Private (Admin, Super Admin)
const createLocation = asyncHandler(async (req, res) => {
  const { name, city, state, country, pincode, geoCoordinates, dietaryType } = req.body;
  const requestedCafe = req.body.cafe || req.body.cafeId;

  // Resolve which cafe this branch belongs to.
  //  - admin:        their own cafe. One cafe → implicit; multiple → must choose one
  //                  they administer; none → they aren't set up to own branches yet.
  //  - super_admin:  must specify the target cafe explicitly.
  let cafeId;
  if (req.user.role === 'admin') {
    const ownCafes = (req.user.cafes || []).map((c) => c.toString());
    if (ownCafes.length === 0) {
      res.status(400);
      throw new Error('You are not assigned to any cafe yet. Ask a super-admin to set one up.');
    }
    if (requestedCafe) {
      if (!ownCafes.includes(requestedCafe.toString())) {
        res.status(403);
        throw new Error('You can only create branches inside a cafe you administer');
      }
      cafeId = requestedCafe;
    } else if (ownCafes.length === 1) {
      cafeId = ownCafes[0];
    } else {
      res.status(400);
      throw new Error('You administer multiple cafes — choose which cafe this branch belongs to');
    }
  } else if (req.user.role === 'super_admin') {
    // Platform owner — may place a branch in any cafe, but must name it.
    if (!requestedCafe) {
      res.status(400);
      throw new Error('Select the cafe this branch belongs to');
    }
    cafeId = requestedCafe;
  } else {
    // Any other role that reached here holds the manageBranches permission but is
    // NOT an admin/super_admin (e.g. a delegated branch_admin). Scope them to the
    // cafe(s) they actually belong to — never trust an arbitrary cafe id.
    const { resolveUserCafeIds } = require('./cafeController');
    const allowed = (await resolveUserCafeIds(req.user)).map((c) => c.toString());
    if (allowed.length === 0) {
      res.status(403);
      throw new Error('You are not associated with any cafe');
    }
    if (!requestedCafe) {
      if (allowed.length === 1) {
        cafeId = allowed[0];
      } else {
        res.status(400);
        throw new Error('Select the cafe this branch belongs to');
      }
    } else {
      if (!allowed.includes(requestedCafe.toString())) {
        res.status(403);
        throw new Error('You can only create branches inside a cafe you belong to');
      }
      cafeId = requestedCafe;
    }
  }

  const cafe = await Cafe.findOne({ _id: cafeId, status: { $ne: 'deleted' } });
  if (!cafe) {
    res.status(404);
    throw new Error('Cafe not found');
  }

  // Branch name is unique within a cafe (per city).
  const locationExists = await Location.findOne({ cafe: cafeId, city, name, isPermanentlyDeleted: { $ne: true } });
  if (locationExists) {
    res.status(400);
    throw new Error('A branch with this name in this city already exists for this cafe');
  }

  const location = await Location.create({
    cafe: cafeId,
    name,
    city,
    state,
    country,
    pincode,
    geoCoordinates,
    dietaryType,
    createdBy: req.user._id,
  });

  // Mirror the new branch into the accessibleLocations of EVERY admin of this cafe
  // (covers the creating admin and any co-admins), so existing branch scoping works.
  await grantBranchToCafeAdmins(cafeId, location._id);

  await logActivity(
    req.user,
    'LOCATION_CREATE',
    `Created new branch: ${location.city} - ${location.name} (cafe: ${cafe.name})`,
    req,
    { locationId: location._id, cafeId }
  );

  await sendNotification({
    title: 'Branch Created',
    message: `New branch ${location.city} - ${location.name} was created by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: location._id,
  });

  res.status(201).json({
    success: true,
    data: location,
  });
});

// @desc    Update location details
// @route   PATCH /api/locations/:id
// @access  Private (Admin, Super Admin)
const updateLocation = asyncHandler(async (req, res) => {
  const { name, city, state, country, pincode, geoCoordinates, status, holdReason, dietaryType } = req.body;

  const location = await Location.findById(req.params.id);

  if (!location || location.isPermanentlyDeleted) {
    res.status(404);
    throw new Error('Location not found');
  }

  // RBAC Enforcement: Admin can only update locations they have permission for
  if (req.user.role === 'admin') {
    const isAccessible = req.user.accessibleLocations?.some(
      loc => loc.toString() === location._id.toString()
    );
    if (!isAccessible) {
      res.status(403);
      throw new Error('You do not have permission to update this location');
    }
  } else if (req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error('Only administrators can update location details');
  }

  // --- Cafe reassignment (move a branch to a different cafe/brand) ---
  // super_admin: may move to any cafe. admin: only between two cafes they BOTH
  // administer. We capture the old cafe so we can re-sync branch access after.
  const requestedCafe = req.body.cafe || req.body.cafeId;
  let oldCafeId = location.cafe;
  let reassigning = false;
  if (requestedCafe && String(requestedCafe) !== String(location.cafe || '')) {
    if (req.user.role !== 'super_admin') {
      const own = (req.user.cafes || []).map((c) => c.toString());
      const ownsSource = location.cafe && own.includes(location.cafe.toString());
      const ownsDest = own.includes(requestedCafe.toString());
      if (!ownsSource || !ownsDest) {
        res.status(403);
        throw new Error('You can only move a branch between cafes you administer');
      }
    }
    const destCafe = await Cafe.findOne({ _id: requestedCafe, status: { $ne: 'deleted' } });
    if (!destCafe) {
      res.status(404);
      throw new Error('Destination cafe not found');
    }
    // Enforce per-cafe name+city uniqueness in the destination cafe.
    const clash = await Location.findOne({
      cafe: requestedCafe,
      city: city || location.city,
      name: name || location.name,
      _id: { $ne: location._id },
      isPermanentlyDeleted: { $ne: true },
    });
    if (clash) {
      res.status(400);
      throw new Error('A branch with this name in this city already exists in the destination cafe');
    }
    location.cafe = requestedCafe;
    reassigning = true;
  }

  if (name) location.name = name;
  if (city) location.city = city;
  if (state) location.state = state;
  if (country) location.country = country;
  if (pincode) location.pincode = pincode;
  if (geoCoordinates) location.geoCoordinates = geoCoordinates;
  if (dietaryType) location.dietaryType = dietaryType;

  if (status) {
    location.status = status;
    if (status === 'hold') {
      location.holdReason = holdReason;
    } else {
      location.holdReason = undefined;
    }
  }

  await location.save();

  // Re-mirror branch access after a cafe move: revoke from the old cafe's admins
  // (unless still reachable elsewhere) and grant to the new cafe's admins.
  if (reassigning) {
    const { moveBranchToCafe } = require('../utils/cafeSync');
    await moveBranchToCafe(oldCafeId, location.cafe, location._id);
  }

  await logActivity(
    req.user,
    'LOCATION_UPDATE',
    `Updated branch details for ${location.city} - ${location.name}`,
    req,
    { locationId: location._id, changes: req.body }
  );

  await sendNotification({
    title: 'Branch Updated',
    message: `Branch ${location.city} - ${location.name} was updated by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: location._id,
  });

  res.json({
    success: true,
    data: location,
  });
});

// @desc    Soft delete a location
// @route   DELETE /api/locations/:id
// @access  Private (Admin, Super Admin)
const softDeleteLocation = asyncHandler(async (req, res) => {
  const location = await Location.findById(req.params.id);

  if (!location || location.isPermanentlyDeleted) {
    res.status(404);
    throw new Error('Location not found');
  }

  // RBAC Enforcement: Admin can only delete locations they have permission for
  if (req.user.role === 'admin') {
    const isAccessible = req.user.accessibleLocations?.some(
      loc => loc.toString() === location._id.toString()
    );
    if (!isAccessible) {
      res.status(403);
      throw new Error('You do not have permission to delete this location');
    }
  } else if (req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error('Only administrators can delete locations');
  }

  // `force` completes the second stage the two-stage design always described but
  // never implemented: the branch and everything that exists only because of it
  // (tables, its own menu, stock, suppliers, forward bookings) are removed for
  // good. Orders, revenue, expenses and payroll are preserved by construction.
  const force = req.body?.force === true || req.query?.force === 'true';
  if (force && req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error('Only a Super Admin can permanently delete a branch');
  }

  // 'detach' keeps the people (auto-moving them to a branch they already had),
  // 'reassign' shifts everyone to a chosen branch, 'delete' removes them too.
  const staffMode = ['delete', 'reassign'].includes(req.body?.staffMode) ? req.body.staffMode : 'detach';
  let staffTargetLocationId = null;
  if (staffMode === 'reassign') {
    staffTargetLocationId = req.body?.staffTargetLocationId;
    const target = staffTargetLocationId ? await Location.findById(staffTargetLocationId) : null;
    if (
      !target ||
      target.isPermanentlyDeleted ||
      target.status === 'deleted' ||
      String(target._id) === String(location._id)
    ) {
      res.status(400);
      throw new Error('Pick a live branch to move the people to');
    }
  }

  // Explicitly chosen financial groups to hard-delete with the branch. Empty =
  // everything preserved (default). Audit logs can never be chosen.
  const purgeKeys = Array.isArray(req.body?.purgeKeys) ? req.body.purgeKeys.map(String) : [];

  let summary = { performed: [], staffAffected: 0 };

  if (force) {
    const { executeLocationPurge } = require('../services/cascadeDelete');
    summary = await executeLocationPurge([location._id], {
      actorId: req.user._id,
      staffMode,
      staffTargetLocationId,
      purgeKeys,
    });
    // The branch→cafe map backing the lockout check is now stale.
    require('../utils/tenantStatus').invalidateTenantCache();
  } else {
    location.status = 'deleted';
    await location.save();
  }

  await logActivity(
    req.user,
    'LOCATION_DELETE',
    `${force ? 'Permanently deleted' : 'Soft-deleted'} branch: ${location.city} - ${location.name}`,
    req,
    { locationId: location._id, force, staffMode, staffTargetLocationId, purgeKeys, removed: summary.performed }
  );

  await sendNotification({
    title: 'Branch Removed',
    message: `Branch ${location.city} - ${location.name} was removed by ${req.user.name}.`,
    type: 'activity',
    priority: 'high',
    performedByUser: req.user,
    locationId: location._id,
  });

  const purgedTotal = (summary.performed || [])
    .filter((r) => r.disposition === 'purged')
    .reduce((s, r) => s + r.count, 0);

  res.json({
    success: true,
    message: force
      ? purgedTotal > 0
        ? `Branch permanently deleted along with ${purgedTotal} financial record(s) you selected. Audit records were preserved.`
        : 'Branch permanently deleted. Financial and audit records were preserved.'
      : 'Location marked as deleted',
    data: summary,
  });
});

// @desc    What a branch deletion would touch
// @route   GET /api/locations/:id/impact
// @access  Private (Admin, Super Admin)
const getLocationImpact = asyncHandler(async (req, res) => {
  const location = await Location.findById(req.params.id);
  if (!location || location.isPermanentlyDeleted) {
    res.status(404);
    throw new Error('Location not found');
  }

  if (req.user.role === 'admin') {
    const isAccessible = req.user.accessibleLocations?.some(
      (loc) => loc.toString() === location._id.toString()
    );
    if (!isAccessible) {
      res.status(403);
      throw new Error('You do not have permission to view this branch');
    }
  } else if (req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error('Only administrators can delete branches');
  }

  const { previewLocationImpact } = require('../services/cascadeDelete');
  const impact = await previewLocationImpact([location._id]);

  res.json({
    success: true,
    data: {
      ...impact,
      subject: { type: 'branch', id: String(location._id), name: `${location.city} - ${location.name}` },
      canPurge: req.user.role === 'super_admin',
    },
  });
});

module.exports = {
  getLocations,
  createLocation,
  updateLocation,
  softDeleteLocation,
  getLocationImpact,
};
