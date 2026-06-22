const express = require('express');
const {
  getPresets,
  createPreset,
  updatePreset,
  deletePreset,
} = require('../controllers/permissionPresetController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);
router.use(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'));

router.route('/')
  .get(getPresets)
  .post(createPreset);

router.route('/:id')
  .put(updatePreset)
  .delete(deletePreset);

module.exports = router;
