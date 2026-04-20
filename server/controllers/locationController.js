const Location = require('../models/Location');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');

// @desc    Get all locations
// @route   GET /api/locations
// @access  Private
const getLocations = asyncHandler(async (req, res) => {
  const { status, city } = req.query;
  
  let query = { isPermanentlyDeleted: false };
  if (status) query.status = status;
  if (city) query.city = city;

  // Filter based on user access
  if (req.user.role === 'location_admin' || req.user.role === 'staff') {
    query._id = req.user.assignedLocation;
  } else if (req.user.role === 'admin' && req.user.accessibleLocations?.length > 0) {
    query._id = { $in: req.user.accessibleLocations };
  }

  const locations = await Location.find(query).populate('createdBy', 'name email');

  res.json({
    success: true,
    count: locations.length,
    data: locations,
  });
});

// @desc    Create a location
// @route   POST /api/locations
// @access  Private (Admin, Super Admin)
const createLocation = asyncHandler(async (req, res) => {
  const { name, city, state, country, pincode, geoCoordinates } = req.body;

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
    createdBy: req.user._id,
  });

  await sendNotification({
    title: 'New Location Created',
    message: `Location "${location.city} - ${location.name}" was created by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
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
  const { name, city, state, country, pincode, geoCoordinates, status, holdReason } = req.body;

  const location = await Location.findById(req.params.id);

  if (!location || location.isPermanentlyDeleted) {
    res.status(404);
    throw new Error('Location not found');
  }

  if (name) location.name = name;
  if (city) location.city = city;
  if (state) location.state = state;
  if (country) location.country = country;
  if (pincode) location.pincode = pincode;
  if (geoCoordinates) location.geoCoordinates = geoCoordinates;
  
  if (status) {
    location.status = status;
    if (status === 'hold') {
      location.holdReason = holdReason;
    } else {
      location.holdReason = undefined;
    }
  }

  await location.save();

  await sendNotification({
    title: 'Location Updated',
    message: `Location "${location.city} - ${location.name}" was updated by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
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

  location.status = 'deleted';
  await location.save();

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
