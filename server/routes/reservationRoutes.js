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
const { verifyToken, checkRoles, checkAction } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Availability check
router.get('/availability', checkAvailability);

// CRUD operations — writes gated by granular actions (legacy roles still pass).
router.route('/')
  .post(checkAction('reservations.add'), createReservation)
  .get(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'), getReservations);

router.route('/:id')
  .get(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), getReservationById)
  .put(checkAction('reservations.modify'), updateReservation)
  .delete(checkAction('reservations.delete'), deleteReservation);

module.exports = router;
