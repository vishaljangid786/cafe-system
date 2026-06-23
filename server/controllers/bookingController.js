const Booking = require('../models/Booking');
const Location = require('../models/Location');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const sendNotification = require('../utils/sendNotification');
const { enforceLocationAccess, clampLimit, escapeRegex, scopedLocationId } = require('../utils/accessControl');

// Returns true when both are valid HH:mm times and end is strictly after start.
const isValidTimeRange = (startTime, endTime) => {
  const re = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!re.test(startTime) || !re.test(endTime)) return false;
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return toMinutes(endTime) > toMinutes(startTime);
};

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

  if (!isValidTimeRange(startTime, endTime)) {
    return res.status(400).json({ success: false, message: 'End time must be after start time' });
  }

  const location = await Location.findById(locationId);
  if (!location) {
    return res.status(404).json({ success: false, message: 'Location not found' });
  }

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
  const { locationId, date, startTime, endTime, numberOfGuests, specialRequests, guestName, guestEmail, guestPhone } = req.body;

  if (!isValidTimeRange(startTime, endTime)) {
    return res.status(400).json({ success: false, message: 'End time must be after start time' });
  }

  const location = await Location.findById(locationId);
  if (!location) {
    return res.status(404).json({ success: false, message: 'Location not found' });
  }

  const maxCapacity = location.maxCapacity || 20;
  const bookedGuests = await getBookedGuests(locationId, date, startTime, endTime);

  if (bookedGuests + numberOfGuests > maxCapacity) {
    return res.status(400).json({
      success: false,
      message: `Cannot book. Only ${Math.max(0, maxCapacity - bookedGuests)} slots available.`
    });
  }

  const isAuthenticated = !!req.user;
  if (!isAuthenticated && !guestName) {
    return res.status(400).json({ success: false, message: 'Guest name is required for unauthenticated bookings' });
  }

  const booking = await Booking.create({
    userId: isAuthenticated ? req.user._id : null,
    guestName: isAuthenticated ? null : guestName,
    guestEmail: isAuthenticated ? null : (guestEmail || null),
    guestPhone: isAuthenticated ? null : (guestPhone || null),
    locationId,
    date: new Date(date),
    startTime,
    endTime,
    numberOfGuests,
    specialRequests
  });

  await booking.populate('locationId', 'name');
  if (isAuthenticated) await booking.populate('userId', 'name email');

  const bookerName = isAuthenticated ? req.user.name : guestName;
  if (isAuthenticated) {
    await sendNotification({
      title: 'New Booking Request',
      message: `${bookerName} requested a booking for ${numberOfGuests} guests at ${location.name} on ${date} (${startTime} - ${endTime}).`,
      type: 'user_action',
      performedByUser: req.user,
      locationId
    });
  }

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
  const { locationId, date, status, search } = req.query;
  const query = {};

  const branchScope = scopedLocationId(req, locationId);
  if (branchScope) query.locationId = branchScope;
  if (date) query.date = new Date(date);
  if (status) query.status = status;
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ guestName: re }, { guestEmail: re }, { guestPhone: re }];
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

  // Notify the user via socket (only if an authenticated user made the booking)
  if (booking.userId) {
    const io = getIO();
    const userId = booking.userId._id?.toString() || booking.userId.toString();
    io.to(userId).emit('booking_status_updated', {
      bookingId: booking._id,
      status: booking.status,
      message: `Your booking at ${booking.locationId?.name} on ${new Date(booking.date).toLocaleDateString()} has been ${status}.`
    });
  }

  res.status(200).json({ success: true, data: booking });
});

module.exports = {
  checkAvailability,
  createBooking,
  getUserBookings,
  getBookings,
  updateBookingStatus
};
