const Location = require('../models/Location');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { logActivity } = require('../utils/auditLogger');
const mongoose = require('mongoose');

// @desc    Get all locations
// @route   GET /api/locations
// @access  Private
const getLocations = asyncHandler(async (req, res) => {
  const { status, city } = req.query;
  
  let query = { isPermanentlyDeleted: false };
  if (status) query.status = status;
  if (city) query.city = city;

  // Filter based on user access
  if (req.user) {
    if (req.user.role === 'branch_admin' || req.user.role === 'staff') {
      if (req.user.assignedLocation) {
        query._id = req.user.assignedLocation;
      } else {
        query._id = new mongoose.Types.ObjectId();
      }
    } else if (req.user.role === 'admin' && req.user.accessibleLocations?.length > 0) {
      query._id = { $in: req.user.accessibleLocations };
    }
  }

  // 1. Fetch Locations
  const locations = await Location.find(query).populate('createdBy', 'name email').lean();

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

  const locationExists = await Location.findOne({ city, name });
  if (locationExists) {
    res.status(400);
    throw new Error('Location with this name in this city already exists');
  }

  const location = await Location.create({
    name,
    city,
    state,
    country,
    pincode,
    geoCoordinates,
    dietaryType,
    createdBy: req.user._id,
  });

  // If an Admin creates a location, automatically add it to their accessible list
  if (req.user.role === 'admin') {
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { accessibleLocations: location._id }
    });
  }

  await logActivity(
    req.user,
    'LOCATION_CREATE',
    `Created new branch: ${location.city} - ${location.name}`,
    req,
    { locationId: location._id }
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
