const express = require('express');
const router = express.Router();
const {
  getCafes,
  getCafe,
  createCafe,
  updateCafe,
  addCafeAdmin,
  removeCafeAdmin,
  deleteCafe,
  getCafeImpact,
  setCafeSuspension,
  uploadCafeLogo,
} = require('../controllers/cafeController');
const { verifyToken, checkRoles, checkRoleOrPermission, checkAction } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validatorMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { createCafeValidator, updateCafeValidator, addAdminValidator } = require('../validators/cafeValidator');

router.use(verifyToken);

// Upload a cafe logo image and get back a hosted URL. Available to super_admins
// and admins (the roles that can edit cafe branding).
router.post(
  '/upload-logo',
  checkRoleOrPermission(['super_admin', 'admin'], 'manageBranches'),
  upload.single('image'),
  uploadCafeLogo
);

// Generic image upload (logo, admin Aadhaar card, admin profile photo) → hosted
// URL. Same handler/permission as the logo upload; the field name is 'image'.
router.post(
  '/upload-image',
  checkRoleOrPermission(['super_admin', 'admin'], 'manageBranches'),
  upload.single('image'),
  uploadCafeLogo
);

router
  .route('/')
  .get(getCafes) // visibility scoped inside the controller (super_admin: all; others: own)
  .post(checkAction('cafes.add'), createCafeValidator, validate, createCafe);

router
  .route('/:id')
  .get(getCafe)
  .patch(updateCafeValidator, validate, updateCafe) // access checked in controller (super_admin or cafe admin)
  .delete(checkAction('cafes.delete'), deleteCafe);

// Blast-radius preview for the delete confirmation, and the cafe-wide lockout.
// Both are platform-level acts, so neither is delegable through actionPermissions.
router.get('/:id/impact', checkRoles('super_admin'), getCafeImpact);
router.patch('/:id/suspension', checkRoles('super_admin'), setCafeSuspension);

router.post('/:id/admins', checkRoles('super_admin'), addAdminValidator, validate, addCafeAdmin);
router.delete('/:id/admins/:userId', checkRoles('super_admin'), removeCafeAdmin);

module.exports = router;
