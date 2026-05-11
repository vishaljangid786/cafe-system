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

router.route('/')
  .get(getLocations)
  .post(verifyToken, checkRoles('super_admin'), ...locationSchema, validate, createLocation);

router.route('/:id')
  .patch(verifyToken, checkRoles('super_admin', 'admin'), ...updateLocationSchema, validate, updateLocation)
  .delete(verifyToken, checkRoles('super_admin'), softDeleteLocation);

module.exports = router;
