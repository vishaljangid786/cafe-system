const express = require('express');
const router = express.Router();
const { getExecutiveSummary, getAuditLogs } = require('../controllers/superAdminController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(authorizeRoles('super_admin'));

router.get('/executive-summary', getExecutiveSummary);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
