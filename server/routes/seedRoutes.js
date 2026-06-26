const express = require('express');
const router = express.Router();
const { seedDatabase, seedStatus } = require('../controllers/seedController');

// GET  /api/seed  -> current seed status (counts, whether enabled)
// POST /api/seed  -> seed sample dashboard data (gated to non-production)
router.get('/', seedStatus);
router.post('/', seedDatabase);

module.exports = router;
