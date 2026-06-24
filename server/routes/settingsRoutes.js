const express = require('express');
const router = express.Router();
const { getEffectiveSettings, updateSettings } = require('../controllers/settingsController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router
  .route('/')
  .get(getEffectiveSettings)
  .put(checkRoles('super_admin', 'admin', 'branch_admin'), updateSettings);

module.exports = router;
