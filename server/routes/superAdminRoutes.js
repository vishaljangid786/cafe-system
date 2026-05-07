const express = require('express');
const router = express.Router();
const { getExecutiveSummary, getAuditLogs } = require('../controllers/superAdminController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.get('/executive-summary', authorizeRoles('super_admin'), getExecutiveSummary);
router.get('/audit-logs', authorizeRoles('super_admin', 'admin'), getAuditLogs);

module.exports = router;
