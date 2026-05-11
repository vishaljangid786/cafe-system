const Booking = require('../models/Booking');
const Location = require('../models/Location');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const sendNotification = require('../utils/sendNotification');
const { enforceLocationAccess, clampLimit } = require('../utils/accessControl');

// Helper to calculate total guests booked for a specific time range
const getBookedGuests = async (locationId, date, startTime, endTime, excludeBookingId = null) => {
  const query = {
    locationId,
    date: new Date(date),
    status: { $in: ['pending', 'confirmed'] },
    $and: [
      { startTime: { $lt: endTime } },
      { endTime: { $gt: startTime } }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const overlappingBookings = await Booking.find(query);
  return overlappingBookings.reduce((total, booking) => total + booking.numberOfGuests, 0);
};

// @desc    Check availability for a slot
// @route   GET /api/bookings/check-availability
// @access  Private
const checkAvailability = asyncHandler(async (req, res) => {
  const { locationId, date, startTime, endTime, numberOfGuests } = req.query;

  if (!locationId || !date || !startTime || !endTime || !numberOfGuests) {
    return res.status(400).json({ success: false, message: 'Please provide all required fields' });
  }

  const location = await Location.findById(locationId);
  if (!location) {
    return res.status(404).json({ success: false, message: 'Location not found' });
  }

  enforceLocationAccess(req, res, locationId, 'You do not have permission to check this location');

  const maxCapacity = location.maxCapacity || 20;
  const bookedGuests = await getBookedGuests(locationId, date, startTime, endTime);
  const requestedGuests = parseInt(numberOfGuests, 10);

  if (bookedGuests + requestedGuests > maxCapacity) {
    return res.status(200).json({ 
      success: true, 
      available: false, 
      message: `Only ${Math.max(0, maxCapacity - bookedGuests)} slots available for this time.`
    });
  }

  res.status(200).json({ success: true, available: true, maxCapacity, bookedGuests });
});

// @desc    Create a booking
// @route   POST /api/bookings
// @access  Private
const createBooking = asyncHandler(async (req, res) => {
  const { locationId, date, startTime, endTime, numberOfGuests, specialRequests } = req.body;

  const location = await Location.findById(locationId);
  if (!location) {
    return res.status(404).json({ success: false, message: 'Location not found' });
  }

  enforceLocationAccess(req, res, locationId, 'You do not have permission to book this location');

  const maxCapacity = location.maxCapacity || 20;
  const bookedGuests = await getBookedGuests(locationId, date, startTime, endTime);

  if (bookedGuests + numberOfGuests > maxCapacity) {
    return res.status(400).json({ 
      success: false, 
      message: `Cannot book. Only ${Math.max(0, maxCapacity - bookedGuests)} slots available.`
    });
  }

  const booking = await Booking.create({
    userId: req.user._id,
    locationId,
    date: new Date(date),
    startTime,
    endTime,
    numberOfGuests,
    specialRequests
  });

  await booking.populate('userId', 'name email');
  await booking.populate('locationId', 'name');

  // Notify admins
  await sendNotification({
    title: 'New Booking Request',
    message: `${req.user.name} requested a booking for ${numberOfGuests} guests at ${location.name} on ${date} (${startTime} - ${endTime}).`,
    type: 'user_action',
    performedByUser: req.user,
    locationId
  });

  res.status(201).json({ success: true, data: booking });
});

// @desc    Get logged in user bookings
// @route   GET /api/bookings/my
// @access  Private
const getUserBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id })
    .populate('locationId', 'name city')
    .sort('-date -createdAt');

  res.status(200).json({ success: true, count: bookings.length, data: bookings });
});

// @desc    Get all bookings (Admin)
// @route   GET /api/bookings
// @access  Private/Admin
const getBookings = asyncHandler(async (req, res) => {
  const { locationId, date, status } = req.query;
  const query = {};

  if (locationId) {
    enforceLocationAccess(req, res, locationId, 'You do not have permission to view this location');
    query.locationId = locationId;
  }
  if (date) query.date = new Date(date);
  if (status) query.status = status;

  // For branch admins, restrict to their assigned location
  if (req.user.role === 'branch_admin') {
    query.locationId = req.user.assignedLocation;
  } else if (req.user.role === 'admin' && !locationId) {
    query.locationId = { $in: req.user.accessibleLocations || [] };
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  const total = await Booking.countDocuments(query);

  const bookings = await Booking.find(query)
    .populate('userId', 'name email phone')
    .populate('locationId', 'name')
    .sort('-date -createdAt')
    .skip(skip)
    .limit(limit);

  res.status(200).json({ 
    success: true, 
    count: bookings.length, 
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
    data: bookings 
  });
});

// @desc    Update booking status
// @route   PATCH /api/bookings/:id/status
// @access  Private/Admin
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const booking = await Booking.findById(req.params.id)
    .populate('userId', 'name email')
    .populate('locationId', 'name');

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  enforceLocationAccess(req, res, booking.locationId._id, 'You do not have permission to update this booking');

  // If changing to confirmed, check capacity again just in case
  if (status === 'confirmed' && booking.status !== 'confirmed') {
    const location = await Location.findById(booking.locationId);
    const maxCapacity = location.maxCapacity || 20;
    const bookedGuests = await getBookedGuests(booking.locationId._id, booking.date, booking.startTime, booking.endTime, booking._id);

    if (bookedGuests + booking.numberOfGuests > maxCapacity) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot confirm. Only ${Math.max(0, maxCapacity - bookedGuests)} slots available.`
      });
    }
  }

  booking.status = status;
  await booking.save();

  // Notify the user via socket
  const io = getIO();
  io.to(booking.userId._id.toString()).emit('booking_status_updated', {
    bookingId: booking._id,
    status: booking.status,
    message: `Your booking at ${booking.locationId.name} on ${new Date(booking.date).toLocaleDateString()} has been ${status}.`
  });

  res.status(200).json({ success: true, data: booking });
});

module.exports = {
  checkAvailability,
  createBooking,
  getUserBookings,
  getBookings,
  updateBookingStatus
};
