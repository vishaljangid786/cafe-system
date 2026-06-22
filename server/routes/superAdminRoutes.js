const express = require('express');
const router = express.Router();
const { getExecutiveSummary, getAuditLogs } = require('../controllers/superAdminController');
const { verifyToken, checkRoles, checkRoleOrPermission } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.get('/executive-summary', checkRoleOrPermission(['super_admin'], 'viewAdminCenter'), getExecutiveSummary);
router.get('/audit-logs', checkRoleOrPermission(['super_admin', 'admin'], 'viewAuditLogs'), getAuditLogs);

module.exports = router;
