const isProduction = () => process.env.NODE_ENV === 'production';

const requiredEnv = () => {
  const required = ['JWT_SECRET', 'MONGO_URI'];

  if (isProduction()) {
    required.push('ENCRYPTION_KEY');
  }

  return required;
};

const getMissingRequiredEnv = () => requiredEnv().filter((key) => !process.env[key]);

const assertRequiredEnv = () => {
  const missing = getMissingRequiredEnv();
  if (missing.length) {
    throw new Error(`[startup] Missing required environment variables: ${missing.join(', ')}. Refusing to start.`);
  }
};

module.exports = {
  assertRequiredEnv,
  getMissingRequiredEnv,
};
