const crypto = require('crypto');

const isProduction = () => process.env.NODE_ENV === 'production';

const safeEquals = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const isInitialSetupAuthorized = (req) => {
  if (!isProduction()) return true;

  const configured = process.env.SETUP_SECRET;
  const supplied = req.get('x-setup-secret');
  return Boolean(configured && supplied && safeEquals(configured, supplied));
};

module.exports = {
  isInitialSetupAuthorized,
};
