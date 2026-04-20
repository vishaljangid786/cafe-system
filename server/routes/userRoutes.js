const express = require('express');
const { 
  getUsers, 
  getUser,
  updateUser, 
  deleteUser, 
  promoteUser,
  demoteUser,
  toggleBlocklist, 
  replaceUser 
} = require('../controllers/userController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(authorizeRoles('super_admin', 'admin', 'branch_admin'), getUsers);

router.route('/:id')
  .get(authorizeRoles('super_admin', 'admin', 'branch_admin'), getUser)
  .put(authorizeRoles('super_admin', 'admin', 'branch_admin'), updateUser)
  .delete(authorizeRoles('super_admin', 'admin', 'branch_admin'), deleteUser);

router.route('/:id/promote')
  .patch(authorizeRoles('super_admin', 'admin'), promoteUser);

router.route('/:id/demote')
  .patch(authorizeRoles('super_admin', 'admin'), demoteUser);

router.patch('/:id/toggle-block', authorizeRoles('super_admin', 'admin'), toggleBlocklist);

router.route('/:id/block')
  .put(authorizeRoles('super_admin', 'admin'), toggleBlocklist);

router.route('/replace')
  .post(authorizeRoles('super_admin', 'admin'), replaceUser);

module.exports = router;
