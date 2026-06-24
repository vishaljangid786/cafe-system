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
  if (status) query.status = status;
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
    .populate('createdBy', 'name email')
    .populate('cafe', 'name logo')
    .lean();

  // 2. Fetch Staff Counts for these locations
  const locationIds = locations.map(l => l._id);
  const personnelCounts = await User.aggregate([
    {
      $match: {
        assignedLocation: { $in: locationIds }
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
  } else {
    // super_admin
    if (!requestedCafe) {
      res.status(400);
      throw new Error('Select the cafe this branch belongs to');
    }
    cafeId = requestedCafe;
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

  await logActivity(
    req.user,
    'LOCATION_UPDATE',
    `Updated branch details for ${location.city} - ${location.name}`,
    req,
    { locationId: location._id, changes: req.body }
  );

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

  location.status = 'deleted';
  await location.save();

  await logActivity(
    req.user,
    'LOCATION_DELETE',
    `Soft-deleted branch: ${location.city} - ${location.name}`,
    req,
    { locationId: location._id }
  );

  res.json({
    success: true,
    message: 'Location marked as deleted',
  });
});

module.exports = {
  getLocations,
  createLocation,
  updateLocation,
  softDeleteLocation,
};
