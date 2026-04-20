const express = require('express');
const {
  getBranches,
  createBranch,
  updateBranch,
  softDeleteBranch,
  hardDeleteBranch,
} = require('../controllers/branchController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .get(getBranches)
  .post(authorizeRoles('super_admin', 'admin'), createBranch);

router.route('/:id')
  .patch(authorizeRoles('super_admin', 'admin'), updateBranch)
  .delete(authorizeRoles('super_admin', 'admin'), softDeleteBranch);

router.route('/:id/permanent')
  .delete(authorizeRoles('super_admin', 'admin'), hardDeleteBranch);

module.exports = router;
