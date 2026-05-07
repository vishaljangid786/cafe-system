const AuditLog = require('../models/AuditLog');

/**
 * Standardized Audit Logging for security and administrative actions.
 * @param {Object} user - The user document performing the action.
 * @param {String} action - Action identifier (e.g., 'LOCATION_CREATE').
 * @param {String} description - Detailed description of the action.
 * @param {Object} req - The Express request object for capturing IP/Agent.
 * @param {Object} metadata - Optional additional context.
 */
const logActivity = async (user, action, description, req, metadata = {}) => {
  try {
    await AuditLog.create({
      action,
      performedBy: user?._id,
      role: user?.role,
      details: description,
      metadata: {
        ...metadata,
        ip: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
      },
      locationId: metadata.locationId || user?.assignedLocation || req?.body?.locationId || req?.params?.locationId || null,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Audit Log Sync Failure:', error);
  }
};

/**
 * Legacy/Security focused logging (matches original logAction signature)
 */
const logSecurityAction = async (req, action, details = {}, targetId = null, targetModel = null) => {
  try {
    await AuditLog.create({
      action,
      performedBy: req.user?._id,
      role: req.user?.role,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      metadata: {
        targetId,
        targetModel,
        ip: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
      },
      locationId: details.locationId || req.body.locationId || req.user?.assignedLocation || null,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Security Log Failure:', error);
  }
};

// Export as both for compatibility
module.exports = { 
  logActivity, 
  logSecurityAction,
  logAction: logSecurityAction 
};
