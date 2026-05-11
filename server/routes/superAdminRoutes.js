const express = require('express');
const router = express.Router();
const { getExecutiveSummary, getAuditLogs } = require('../controllers/superAdminController');
const { verifyToken, checkRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.get('/executive-summary', checkRoles('super_admin'), getExecutiveSummary);
router.get('/audit-logs', checkRoles('super_admin', 'admin'), getAuditLogs);

module.exports = router;
