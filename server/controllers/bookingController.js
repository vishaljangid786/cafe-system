const Booking = require('../models/Booking');
const crypto = require('crypto');
const Location = require('../models/Location');
const Reservation = require('../models/Reservation');
const Table = require('../models/Table');
const asyncHandler = require('../utils/asyncHandler');
const { getIO } = require('../config/socket');
const sendNotification = require('../utils/sendNotification');
const { notifyCustomer } = require('../services/customerNotify');
const { enforceLocationAccess, clampLimit, escapeRegex, scopedLocationId } = require('../utils/accessControl');

const BOOKING_STATUSES = new Set(['pending', 'confirmed', 'cancelled', 'completed']);

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

// Asia/Kolkata is a fixed +05:30 offset. Comparing calendar days in IST (the
// product's business timezone) instead of server-local time stops a booking for
// "today" being rejected as past when the runtime clock is on UTC.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istCalendarDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NaN;
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
};

const isTodayOrFuture = (date) => {
  const bookingDay = istCalendarDay(date);
  if (Number.isNaN(bookingDay)) return false;
  return bookingDay >= istCalendarDay(new Date());
};

// Booking/reservation dates are stored from date-only strings ("YYYY-MM-DD"),
// which parse to UTC midnight. Matching on an exact Date is fragile — any stray
// time component or offset makes the query return NOTHING, silently skipping the
// capacity check and allowing an overbooking. Match the whole UTC day instead.
const dayRange = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const bookingLockKey = (locationId, date) => {
  const day = new Date(date).toISOString().slice(0, 10);
  return `booking:${locationId}:${day}`;
};

const acquireBookingLock = async (locationId, date) => {
  const locks = Booking.db.collection('booking_locks');
  const _id = bookingLockKey(locationId, date);
  const token = crypto.randomBytes(12).toString('hex');

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + 15000);
    try {
      const result = await locks.findOneAndUpdate(
        {
          _id,
          $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: { $exists: false } }],
        },
        {
          $set: { token, lockedUntil, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, returnDocument: 'after' }
      );
      const doc = result && (result.value !== undefined ? result.value : result);
      if (doc?.token === token) {
        return {
          release: () => locks.deleteOne({ _id, token }),
        };
      }
    } catch (err) {
      if (!err || ![11000, 11001].includes(err.code)) throw err;
    }
    await sleep(100);
  }

  const err = new Error('Booking slot is busy. Please try again.');
  err.statusCode = 423;
  throw err;
};

const getBookableLocation = async (res, locationId) => {
  const location = await Location.findById(locationId);
  if (!location || location.isPermanentlyDeleted) {
    res.status(404);
    throw new Error('Location not found');
  }

  if (location.status !== 'active') {
    res.status(400);
    throw new Error('This location is not accepting bookings right now');
  }

  // A blocked cafe stops taking reservations across every one of its branches.
  const { getSuspendedCafes } = require('../utils/tenantStatus');
  if (location.cafe && (await getSuspendedCafes()).has(String(location.cafe))) {
    res.status(403);
    const err = new Error('This location is not accepting bookings right now');
    err.code = 'CAFE_SUSPENDED';
    throw err;
  }

  return location;
};

// Helper to calculate total guests booked for a specific time range
const getBookedGuests = async (locationId, date, startTime, endTime, excludeBookingId = null) => {
  const query = {
    locationId,
    date: dayRange(date),
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
  let total = overlappingBookings.reduce((sum, booking) => sum + (booking.numberOfGuests || 0), 0);

  // Also count capacity held by INTERNAL reservations in the same window, so public
  // bookings + reservations can't over-allocate the same physical room/tables.
  const reservations = await Reservation.find({
    locationId,
    date: dayRange(date),
    status: { $nin: ['cancelled', 'no-show'] },
    $or: [
      { isFullDay: true },
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
    ],
  });
  if (reservations.length) {
    // A full-location (or full-day) reservation holds the entire room.
    if (reservations.some((r) => r.reservationType === 'full-location' || r.isFullDay)) {
      const loc = await Location.findById(locationId).select('maxCapacity');
      return loc?.maxCapacity || 20;
    }
    // Otherwise subtract the seating capacity of the specific reserved tables.
    const reservedTableIds = reservations.flatMap((r) => r.tableIds || []);
    if (reservedTableIds.length) {
      const tables = await Table.find({ _id: { $in: reservedTableIds } }).select('capacity');
      total += tables.reduce((sum, t) => sum + (t.capacity || 0), 0);
    }
  }
  return total;
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

  if (!isTodayOrFuture(date)) {
    return res.status(400).json({ success: false, message: 'Booking date cannot be in the past' });
  }

  const requestedGuests = Number(numberOfGuests);
  if (!Number.isInteger(requestedGuests) || requestedGuests < 1) {
    return res.status(400).json({ success: false, message: 'At least 1 guest is required' });
  }

  const location = await getBookableLocation(res, locationId);
  const maxCapacity = location.maxCapacity || 20;
  const bookedGuests = await getBookedGuests(locationId, date, startTime, endTime);

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

  if (!isTodayOrFuture(date)) {
    return res.status(400).json({ success: false, message: 'Booking date cannot be in the past' });
  }

  const guestCount = Number(numberOfGuests);
  if (!Number.isInteger(guestCount) || guestCount < 1) {
    return res.status(400).json({ success: false, message: 'At least 1 guest is required' });
  }

  const isAuthenticated = !!req.user;
  if (!isAuthenticated && !guestName) {
    return res.status(400).json({ success: false, message: 'Guest name is required for unauthenticated bookings' });
  }

  const location = await getBookableLocation(res, locationId);
  const lock = await acquireBookingLock(locationId, date);
  let booking;
  try {
    const maxCapacity = location.maxCapacity || 20;
    const bookedGuests = await getBookedGuests(locationId, date, startTime, endTime);

    if (bookedGuests + guestCount > maxCapacity) {
      res.status(400);
      throw new Error(`Cannot book. Only ${Math.max(0, maxCapacity - bookedGuests)} slots available.`);
    }

    booking = await Booking.create({
      userId: isAuthenticated ? req.user._id : null,
      guestName: isAuthenticated ? null : guestName,
      guestEmail: isAuthenticated ? null : (guestEmail || null),
      guestPhone: isAuthenticated ? null : (guestPhone || null),
      locationId,
      date: new Date(date),
      startTime,
      endTime,
      numberOfGuests: guestCount,
      specialRequests
    });
  } finally {
    await lock.release();
  }

  await booking.populate('locationId', 'name');
  if (isAuthenticated) await booking.populate('userId', 'name email');

  const bookerName = isAuthenticated ? req.user.name : guestName;
  if (isAuthenticated) {
    await sendNotification({
      title: 'New Booking Request',
      message: `${bookerName} requested a booking for ${guestCount} guests at ${location.name} on ${date} (${startTime} - ${endTime}).`,
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
  if (!BOOKING_STATUSES.has(status)) {
    return res.status(400).json({ success: false, message: 'Invalid booking status' });
  }

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

  // Best-effort SMS/WhatsApp to a guest who booked without an account.
  if (status === 'confirmed' && booking.guestPhone) {
    const when = `${new Date(booking.date).toLocaleDateString('en-IN')}${booking.startTime ? ` ${booking.startTime}` : ''}`;
    notifyCustomer(booking.guestPhone, `Hi${booking.guestName ? ` ${booking.guestName}` : ''}! Your booking at ${booking.locationId?.name || 'our cafe'} for ${when} is confirmed. See you soon!`, { type: 'booking-confirmed' });
  }

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

  await sendNotification({
    title: 'Booking Status Updated',
    message: `A booking at ${booking.locationId?.name || 'a location'} was marked ${status} by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: booking.locationId._id
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
