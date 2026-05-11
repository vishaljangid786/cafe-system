const express = require('express');
const { 
  getUsers, 
  getUser,
  updateUser, 
  deleteUser, 
  promoteUser,
  demoteUser,
  toggleBlocklist,
  updateProfile,
  changePassword,
  updateUserPermissions
} = require('../controllers/userController');
const { verifyToken, checkRoles, checkPermissions } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(verifyToken);

router.put('/update-profile', upload.single('profileImage'), updateProfile);
router.put('/change-password', changePassword);

// Staff Management Routes - Require manageStaff permission
router.use(checkPermissions('manageStaff'));

router.route('/')
  .get(checkRoles('super_admin', 'admin', 'branch_admin'), getUsers);

router.route('/:id')
  .get(checkRoles('super_admin', 'admin', 'branch_admin'), getUser)
  .put(checkRoles('super_admin', 'admin', 'branch_admin'), updateUser)
  .delete(checkRoles('super_admin', 'admin', 'branch_admin'), deleteUser);

router.route('/:id/permissions')
  .put(checkRoles('super_admin', 'admin', 'branch_admin'), updateUserPermissions);

router.route('/:id/promote')
  .patch(checkRoles('super_admin', 'admin'), promoteUser);

router.route('/:id/demote')
  .patch(checkRoles('super_admin', 'admin'), demoteUser);

router.patch('/:id/toggle-block', checkRoles('super_admin', 'admin'), toggleBlocklist);

router.route('/:id/block')
  .put(checkRoles('super_admin', 'admin'), toggleBlocklist);

module.exports = router;
