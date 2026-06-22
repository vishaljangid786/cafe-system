const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
if (!process.env.ENCRYPTION_KEY) {
  const msg = 'ENCRYPTION_KEY is not set — the in-source fallback key is committed, so stored Aadhaar PII would be trivially decryptable.';
  // Fail closed in production: never run real PII on the public fallback key.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`[security] ${msg} Refusing to start — set ENCRYPTION_KEY in the backend environment (keep it constant, or existing records won't decrypt).`);
  }
  console.warn(`[security] ${msg} Using a dev fallback; set ENCRYPTION_KEY before deploying.`);
}
const KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'cafe-system-secure-key-2026', 'salt', 32);
const IV_LENGTH = 16;

const encrypt = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (text) => {
  if (!text || !text.includes(':')) return text;
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

module.exports = { encrypt, decrypt };
