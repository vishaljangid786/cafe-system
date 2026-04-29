const AuditLog = require('../models/AuditLog');

const logSecurityAction = async (req, action, details = {}, targetId = null, targetModel = null) => {
  try {
    await AuditLog.create({
      action,
      performedBy: req.user?._id,
      role: req.user?.role,
      details,
      targetId,
      targetModel,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent']
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};

module.exports = { logSecurityAction };
