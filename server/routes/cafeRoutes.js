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
} = require('../controllers/cafeController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validatorMiddleware');
const { createCafeValidator, updateCafeValidator, addAdminValidator } = require('../validators/cafeValidator');

router.use(verifyToken);

router
  .route('/')
  .get(getCafes) // visibility scoped inside the controller (super_admin: all; others: own)
  .post(checkRoles('super_admin'), createCafeValidator, validate, createCafe);

router
  .route('/:id')
  .get(getCafe)
  .patch(updateCafeValidator, validate, updateCafe) // access checked in controller (super_admin or cafe admin)
  .delete(checkRoles('super_admin'), deleteCafe);

router.post('/:id/admins', checkRoles('super_admin'), addAdminValidator, validate, addCafeAdmin);
router.delete('/:id/admins/:userId', checkRoles('super_admin'), removeCafeAdmin);

module.exports = router;
