const express = require('express');
const router = express.Router();
const {
  checkAvailability,
  createReservation,
  getReservations,
  getReservationById,
  updateReservation,
  deleteReservation,
} = require('../controllers/reservationController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Availability check
router.get('/availability', checkAvailability);

// CRUD operations
router.route('/')
  .post(createReservation)
  .get(getReservations);

router.route('/:id')
  .get(getReservationById)
  .put(updateReservation)
  .delete(deleteReservation);

module.exports = router;
