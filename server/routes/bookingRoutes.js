const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  checkAvailability,
  createBooking,
  getUserBookings,
  getBookings,
  updateBookingStatus
} = require('../controllers/bookingController');
const { verifyToken, optionalVerifyToken, checkRoles } = require('../middlewares/authMiddleware');
const { bookingSchema, validate } = require('../middlewares/validateMiddleware');

// These endpoints are public (guests can book). A dedicated low-ceiling limiter
// prevents a single IP from exhausting a location's capacity or scraping
// availability with automated requests. Keyed per IP, well below the global
// /api/ limiter.
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // 15 booking-related requests per IP per hour
  message: 'Too many booking requests from this IP, please try again later.'
});

// Public endpoints — no auth required for guests
router.get('/check-availability', bookingLimiter, checkAvailability);
router.post('/', bookingLimiter, optionalVerifyToken, ...bookingSchema, validate, createBooking);

// Get user's own bookings
router.get('/my', verifyToken, getUserBookings);

// Get all bookings (Admin/Location Admin)
router.get('/', verifyToken, checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), getBookings);

// Update booking status (Admin/Location Admin)
router.patch('/:id/status', verifyToken, checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), updateBookingStatus);

module.exports = router;
