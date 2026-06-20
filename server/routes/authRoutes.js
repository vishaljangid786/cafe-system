const express = require('express');
const { registerUser, loginUser, getProfile, impersonateUser, exitImpersonation, logoutUser } = require('../controllers/authController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');
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

router.post('/register', authLimiter, maybeVerifyToken, upload.fields([{ name: 'aadharImage', maxCount: 1 }, { name: 'profileImage', maxCount: 1 }]), ...signupSchema, validate, registerUser);
router.post('/login', authLimiter, ...loginSchema, validate, loginUser);
router.get('/profile', verifyToken, getProfile);

router.post('/impersonate/:userId', verifyToken, checkRoles('super_admin'), impersonateUser);
router.post('/exit-impersonation', verifyToken, exitImpersonation);
router.get('/logout', logoutUser);

module.exports = router;
