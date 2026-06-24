const express = require('express');
const router = express.Router();
const {
  createLeaveRequest,
  getLeaveRequests,
  reviewLeaveRequest,
  cancelLeaveRequest,
} = require('../controllers/leaveRequestController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router
  .route('/')
  .get(getLeaveRequests)               // staff -> own; admins -> their branch
  .post(createLeaveRequest);           // self-service request

router.patch('/:id/review', checkRoles('super_admin', 'admin', 'branch_admin', 'location_admin'), reviewLeaveRequest);
router.delete('/:id', cancelLeaveRequest); // cancel own pending

module.exports = router;
