const express = require('express');
const router = express.Router();
const { seedDatabase, seedStatus } = require('../controllers/seedController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

// Both routes require an authenticated super_admin. Previously they were public:
// GET leaked environment name + live row counts, and POST could inject fabricated
// revenue/attendance in any non-production (or ALLOW_SEED) environment. seedDatabase
// still enforces its own NODE_ENV/ALLOW_SEED gate on top of this.
// GET  /api/seed  -> current seed status (counts, whether enabled)
// POST /api/seed  -> seed sample dashboard data (gated to non-production)
router.get('/', verifyToken, checkRoles('super_admin'), seedStatus);
router.post('/', verifyToken, checkRoles('super_admin'), seedDatabase);

module.exports = router;
