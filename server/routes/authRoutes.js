const express = require('express');
const { registerUser, loginUser, getProfile } = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.post('/register', upload.single('aadharImage'), registerUser);
router.post('/login', loginUser);
router.get('/profile', verifyToken, getProfile);

module.exports = router;
