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
  .post(authorizeRoles('super_admin', 'admin', 'branch_admin', 'staff'), createReservation)
  .get(authorizeRoles('super_admin', 'admin', 'branch_admin', 'staff'), getReservations);

router.route('/:id')
  .get(authorizeRoles('super_admin', 'admin', 'branch_admin', 'staff'), getReservationById)
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin', 'staff'), updateReservation)
  .delete(authorizeRoles('super_admin', 'admin', 'branch_admin', 'staff'), deleteReservation);

module.exports = router;
