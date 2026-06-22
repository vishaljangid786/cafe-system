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
const { verifyToken, checkRoles, checkPermissions, checkRoleOrPermission } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(verifyToken);

router.put('/update-profile', upload.single('profileImage'), updateProfile);
router.put('/change-password', changePassword);

// Staff Management Routes - Require manageStaff permission
router.use(checkPermissions('manageStaff'));

router.route('/')
  .get(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin', 'location_admin'], 'manageStaff'), getUsers);

router.route('/:id')
  .get(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin', 'location_admin'], 'manageStaff'), getUser)
  .put(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin', 'location_admin'], 'manageStaff'), updateUser)
  .delete(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin', 'location_admin'], 'manageStaff'), deleteUser);

router.route('/:id/permissions')
  .put(checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), updateUserPermissions);

router.route('/:id/promote')
  .patch(checkRoles('super_admin', 'admin'), promoteUser);

router.route('/:id/demote')
  .patch(checkRoles('super_admin', 'admin'), demoteUser);

router.patch('/:id/toggle-block', checkRoleOrPermission(['super_admin', 'admin'], 'manageStaff'), toggleBlocklist);

router.route('/:id/block')
  .put(checkRoleOrPermission(['super_admin', 'admin'], 'manageStaff'), toggleBlocklist);

module.exports = router;
