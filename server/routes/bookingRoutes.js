const express = require('express');
const router = express.Router();
const {
  checkAvailability,
  createBooking,
  getUserBookings,
  getBookings,
  updateBookingStatus
} = require('../controllers/bookingController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');
const { bookingSchema, validate } = require('../middlewares/validateMiddleware');

// Public endpoints — no auth required for guests
router.get('/check-availability', checkAvailability);
router.post('/', ...bookingSchema, validate, createBooking);

// Get user's own bookings
router.get('/my', verifyToken, getUserBookings);

// Get all bookings (Admin/Location Admin)
router.get('/', verifyToken, checkRoles('super_admin', 'admin', 'branch_admin'), getBookings);

// Update booking status (Admin/Location Admin)
router.patch('/:id/status', verifyToken, checkRoles('super_admin', 'admin', 'branch_admin'), updateBookingStatus);

module.exports = router;
