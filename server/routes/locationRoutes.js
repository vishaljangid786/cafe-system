const express = require('express');
const {
  getLocations,
  createLocation,
  updateLocation,
  softDeleteLocation,
} = require('../controllers/locationController');
const { verifyToken, checkRoles, checkRoleOrPermission, checkAction } = require('../middlewares/authMiddleware');
const { locationSchema, updateLocationSchema, validate } = require('../middlewares/validateMiddleware');

const router = express.Router();

// Public endpoint for the booking page — returns only active locations with limited fields
router.get('/public', async (req, res) => {
  try {
    const Location = require('../models/Location');
    const locations = await Location.find({ status: 'active' })
      .select('name city address maxCapacity status')
      .lean();
    res.json({ success: true, data: locations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.route('/')
  .get(verifyToken, getLocations)
  // Admins can create branches inside their own cafe; super_admin / anyone with the
  // manageBranches permission can too. Cafe ownership is enforced in the controller.
  .post(verifyToken, checkAction('branches.add'), ...locationSchema, validate, createLocation);

router.route('/:id')
  .patch(verifyToken, checkAction('branches.modify'), ...updateLocationSchema, validate, updateLocation)
  .delete(verifyToken, checkAction('branches.delete'), softDeleteLocation);

module.exports = router;
