const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
if (!process.env.ENCRYPTION_KEY) {
  // Do NOT ship to production without this set: the fallback key is in source
  // control, so anyone with the repo can decrypt stored Aadhaar numbers. Keep
  // ENCRYPTION_KEY constant once set, or existing records won't decrypt.
  console.warn('[security] ENCRYPTION_KEY is not set — Aadhaar PII is encrypted with an INSECURE built-in fallback key. Set ENCRYPTION_KEY in the backend environment.');
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
