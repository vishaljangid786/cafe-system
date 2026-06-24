const express = require('express');
const router = express.Router();
const { getEffectiveSettings, updateSettings } = require('../controllers/settingsController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router
  .route('/')
  .get(getEffectiveSettings)
  // location_admin is allowed here too: the controller restricts non-super-admins
  // to branch-scoped saves (rejects a null/global locationId) and enforces
  // canAccessLocation, and the Settings page is shown to them in the sidebar.
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), updateSettings);

module.exports = router;
