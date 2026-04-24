const AuditLog = require('../models/AuditLog');

/**
 * Logs sensitive actions to the AuditLog collection
 * Especially useful during impersonation sessions
 */
const logAction = async (req, action, details, targetUser = null) => {
  try {
    const logData = {
      action,
      performedBy: req.user._id,
      details,
      ipAddress: req.ip,
      targetUser: targetUser || req.params.id || null
    };

    // If it's an impersonation session, the "performedBy" is the impersonated user (req.user),
    // but the AuditLog schema should ideally track the original admin too.
    // However, our current AuditLog model has 'performedBy' and 'targetUser'.
    // I will append impersonator info to the details for transparency.
    
    if (req.impersonator) {
      logData.details = `[IMPERSONATION BY ${req.impersonator.name}] ${details}`;
    }

    await AuditLog.create(logData);
    
    if (req.impersonator) {
      console.log(`[AUDIT-IMPERSONATION] ${req.impersonator.name} performed ${action} as ${req.user.name}`);
    }
  } catch (error) {
    console.error('[AUDIT-LOG-ERROR] Failed to record audit log:', error);
  }
};

module.exports = { logAction };
