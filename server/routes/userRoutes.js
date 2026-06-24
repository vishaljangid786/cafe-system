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

// Staff Management Routes — each route below carries its own per-route gate
// (role OR manageStaff). A blanket router.use(checkPermissions('manageStaff'))
// here defeated those role-based grants (e.g. branch_admin without the explicit
// manageStaff permission), so authorization is enforced per route instead.

router.route('/')
  .get(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin', 'location_admin'], 'manageStaff'), getUsers);

router.route('/:id')
  .get(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin', 'location_admin'], 'manageStaff'), getUser)
  .put(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin', 'location_admin'], 'manageStaff'), updateUser)
  .delete(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin', 'location_admin'], 'manageStaff'), deleteUser);

router.route('/:id/permissions')
  .put(checkRoles('super_admin', 'admin', 'branch_admin'), updateUserPermissions);

router.route('/:id/promote')
  .patch(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin'], 'manageStaff'), promoteUser);

router.route('/:id/demote')
  .patch(checkRoleOrPermission(['super_admin', 'admin', 'branch_admin'], 'manageStaff'), demoteUser);

router.patch('/:id/toggle-block', checkRoleOrPermission(['super_admin', 'admin'], 'manageStaff'), toggleBlocklist);

router.route('/:id/block')
  .put(checkRoleOrPermission(['super_admin', 'admin'], 'manageStaff'), toggleBlocklist);

module.exports = router;
