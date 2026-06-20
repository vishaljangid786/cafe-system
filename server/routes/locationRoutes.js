const express = require('express');
const {
  getLocations,
  createLocation,
  updateLocation,
  softDeleteLocation,
} = require('../controllers/locationController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');
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
  .post(verifyToken, checkRoles('super_admin'), ...locationSchema, validate, createLocation);

router.route('/:id')
  .patch(verifyToken, checkRoles('super_admin', 'admin'), ...updateLocationSchema, validate, updateLocation)
  .delete(verifyToken, checkRoles('super_admin'), softDeleteLocation);

module.exports = router;
