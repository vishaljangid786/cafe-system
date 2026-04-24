const express = require('express');
const { registerUser, loginUser, getProfile, impersonateUser, exitImpersonation, initialSetupCheck } = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { signupSchema, loginSchema, validate } = require('../middlewares/validateMiddleware');

const router = express.Router();

router.post('/register', upload.fields([{ name: 'aadharImage', maxCount: 1 }, { name: 'profileImage', maxCount: 1 }]), ...signupSchema, validate, registerUser);
router.post('/login', ...loginSchema, validate, loginUser);
router.get('/profile', verifyToken, getProfile);
router.get('/initial-setup-check', initialSetupCheck);
router.post('/impersonate/:userId', verifyToken, impersonateUser);
router.post('/exit-impersonation', verifyToken, exitImpersonation);

module.exports = router;
