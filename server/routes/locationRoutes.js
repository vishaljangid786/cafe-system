const express = require('express');
const {
  getLocations,
  createLocation,
  updateLocation,
  softDeleteLocation,
} = require('../controllers/locationController');
const { verifyToken, checkRoles, checkRoleOrPermission } = require('../middlewares/authMiddleware');
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
  .post(verifyToken, checkRoleOrPermission(['super_admin'], 'manageBranches'), ...locationSchema, validate, createLocation);

router.route('/:id')
  .patch(verifyToken, checkRoleOrPermission(['super_admin', 'admin'], 'manageBranches'), ...updateLocationSchema, validate, updateLocation)
  .delete(verifyToken, checkRoleOrPermission(['super_admin'], 'manageBranches'), softDeleteLocation);

module.exports = router;
