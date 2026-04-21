const express = require('express');
const router = express.Router();
const {
  checkAvailability,
  createBooking,
  getUserBookings,
  getBookings,
  updateBookingStatus
} = require('../controllers/bookingController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { bookingSchema, validate } = require('../middlewares/validateMiddleware');

// Check availability (can be accessed by any logged-in user)
router.get('/check-availability', verifyToken, checkAvailability);

// Create a booking (any logged-in user)
router.post('/', verifyToken, bookingSchema, validate, createBooking);

// Get user's own bookings
router.get('/my', verifyToken, getUserBookings);

// Get all bookings (Admin/Location Admin)
router.get('/', verifyToken, authorizeRoles('super_admin', 'admin', 'location_admin'), getBookings);

// Update booking status (Admin/Location Admin)
router.patch('/:id/status', verifyToken, authorizeRoles('super_admin', 'admin', 'location_admin'), updateBookingStatus);

module.exports = router;
