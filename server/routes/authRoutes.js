const express = require('express');
const { registerUser, loginUser, getProfile, impersonateUser, exitImpersonation, logoutUser } = require('../controllers/authController');
const { verifyToken, checkRoles, checkRoleOrPermission } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { signupSchema, loginSchema, validate } = require('../middlewares/validateMiddleware');

const User = require('../models/User');

const rateLimit = require('express-rate-limit');
const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  message: { message: 'Too many login attempts, please try again after 15 minutes' }
});

// Middleware to skip auth ONLY if no users exist (Initial Setup)
const maybeVerifyToken = async (req, res, next) => {
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    return next();
  }
  return verifyToken(req, res, next);
};

// Coarse role gate that runs BEFORE the Cloudinary upload, using only req.user
// (the body/role isn't parsed yet — that's multer's job). Rejects creators who
// can never register anyone (staff/chef/location_admin), so unauthorized callers
// don't trigger a wasteful file upload. The fine-grained per-role gate (which
// needs the parsed body) still runs inside registerUser. Skipped during initial
// setup when there is no authenticated creator yet.
const CREATOR_ROLES = ['super_admin', 'admin', 'branch_admin'];
const gateCanCreateUser = (req, res, next) => {
  if (req.user && !CREATOR_ROLES.includes(req.user.role)) {
    res.status(403);
    return next(new Error('You do not have permission to add new staff'));
  }
  return next();
};

router.post('/register', authLimiter, maybeVerifyToken, gateCanCreateUser, upload.fields([{ name: 'aadharImage', maxCount: 1 }, { name: 'profileImage', maxCount: 1 }]), ...signupSchema, validate, registerUser);
router.post('/login', authLimiter, ...loginSchema, validate, loginUser);
router.get('/profile', verifyToken, getProfile);

router.post('/impersonate/:userId', verifyToken, checkRoleOrPermission(['super_admin'], 'impersonateUsers'), impersonateUser);
router.post('/exit-impersonation', verifyToken, exitImpersonation);
router.post('/logout', verifyToken, logoutUser);

module.exports = router;
