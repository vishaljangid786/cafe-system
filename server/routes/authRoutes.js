const express = require('express');
const { registerUser, loginUser, getProfile } = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { signupSchema, loginSchema, validate } = require('../middlewares/validateMiddleware');

const router = express.Router();

router.post('/register', upload.single('aadharImage'), signupSchema, validate, registerUser);
router.post('/login', loginSchema, validate, loginUser);
router.get('/profile', verifyToken, getProfile);

module.exports = router;
