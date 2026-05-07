const express = require('express');
const {
  getLocations,
  createLocation,
  updateLocation,
  softDeleteLocation,
} = require('../controllers/locationController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { locationSchema, updateLocationSchema, validate } = require('../middlewares/validateMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getLocations)
  .post(authorizeRoles('super_admin'), ...locationSchema, validate, createLocation);

router.route('/:id')
  .patch(authorizeRoles('super_admin', 'admin'), ...updateLocationSchema, validate, updateLocation)
  .delete(authorizeRoles('super_admin'), softDeleteLocation);

module.exports = router;
