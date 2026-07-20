const crypto = require('crypto');

const LEGACY_ALGORITHM = 'aes-256-cbc';
const ALGORITHM = 'aes-256-gcm';
if (!process.env.ENCRYPTION_KEY) {
  const msg = 'ENCRYPTION_KEY is not set — the in-source fallback key is committed, so stored Aadhaar PII would be trivially decryptable.';
  // Fail closed in production: never run real PII on the public fallback key.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`[security] ${msg} Refusing to start — set ENCRYPTION_KEY in the backend environment (keep it constant, or existing records won't decrypt).`);
  }
  console.warn(`[security] ${msg} Using a dev fallback; set ENCRYPTION_KEY before deploying.`);
}
const KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'cafe-system-secure-key-2026', 'salt', 32);
const IV_LENGTH = 12;
const LEGACY_IV_LENGTH = 16;

const encrypt = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (text) => {
  if (!text || !text.includes(':')) return text;
  try {
    const textParts = text.split(':');
    if (textParts[0] === 'gcm') {
      textParts.shift();
      const iv = Buffer.from(textParts.shift(), 'hex');
      const tag = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    }

    const iv = Buffer.from(textParts.shift(), 'hex');
    if (iv.length !== LEGACY_IV_LENGTH) return '';
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    // A value that can't be decrypted (corrupt ciphertext, or — most commonly —
    // ENCRYPTION_KEY differs from the one used to encrypt it, e.g. data seeded
    // with the dev fallback key but served under a real production key) must NOT
    // throw. This getter runs on EVERY user serialization (schema toJSON/toObject
    // use `getters: true`), so a throw here 500s /auth/profile and any user-
    // returning endpoint — which logs the whole app out on reload. Fail soft:
    // treat the unreadable PII as empty rather than taking auth down with it.
    console.warn(`[security] aadhaar decrypt failed (${err.code || err.message}) — check ENCRYPTION_KEY matches the key used to store this data.`);
    return '';
  }
};

module.exports = { encrypt, decrypt };
