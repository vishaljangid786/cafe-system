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
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Availability check
router.get('/availability', checkAvailability);

// CRUD operations
router.route('/')
  .post(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'), createReservation)
  .get(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'), getReservations);

router.route('/:id')
  .get(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), getReservationById)
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), updateReservation)
  .delete(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), deleteReservation);

module.exports = router;
