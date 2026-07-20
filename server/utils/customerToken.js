// Opaque customer identity token for the PUBLIC (unauthenticated) scan flow.
//
// Why this exists: the scan page needs to recognise a returning customer without
// ever exposing a "give me the profile for this phone number" endpoint — that
// would be a PII-enumeration hole (iterate numbers, harvest names/emails/DOBs).
// Instead the server hands out an HMAC of the customer id, the browser stores it,
// and later scans present the token. Possession of the token is the only way to
// read a profile, and a token cannot be forged without JWT_SECRET.
//
// Format: `v1.<customerId>.<base64url HMAC-SHA256 of "v1.<customerId>">`
const crypto = require('crypto');

const VERSION = 'v1';

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not configured');
  return s;
};

const signature = (payload) =>
  crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

const timingSafeEquals = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const signCustomerToken = (customerId) => {
  const payload = `${VERSION}.${String(customerId)}`;
  return `${payload}.${signature(payload)}`;
};

// Returns the customerId string, or null for anything malformed/forged/expired-format.
const verifyCustomerToken = (token) => {
  const raw = String(token || '');
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [version, customerId, sig] = parts;
  if (version !== VERSION) return null;
  if (!/^[a-f0-9]{24}$/i.test(customerId)) return null;
  if (!timingSafeEquals(signature(`${version}.${customerId}`), sig)) return null;
  return customerId;
};

module.exports = { signCustomerToken, verifyCustomerToken };
