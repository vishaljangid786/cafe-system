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
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Throttle password changes: the current-password check is a brute-force target for
// anyone holding a stolen session. Tight per-IP cap on top of the global limiter.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password change attempts. Please try again later.' },
});

router.use(verifyToken);

router.put('/update-profile', upload.single('profileImage'), updateProfile);
router.put('/change-password', changePasswordLimiter, changePassword);

// Staff Management Routes - Require manageStaff permission
router.use(checkPermissions('manageStaff'));

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
