// Canonical phone normalization — the single definition of "same human".
//
// The customer identity model keys one Customer document per phone number, so the
// normalization has to be canonical: "+91 98765 43210", "098765 43210" and
// "9876543210" are the same person and must collapse to the same key. Stripping
// only non-digits (the older inline rule) left the country code in place, which
// silently created a SECOND identity for the same customer depending on how they
// typed their number.
//
// Rules (India-first, matching the product's INR/Asia-Kolkata defaults):
//   - keep digits only
//   - 12 digits starting with the 91 country code -> drop it
//   - 11 digits starting with a trunk 0            -> drop it
//   - cap at 15 digits (E.164 maximum)
const normalizePhone = (raw) => {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 15);
};

// A usable Indian mobile number after normalization.
const isValidPhone = (raw) => normalizePhone(raw).length >= 10;

// Show only the last 4 digits. Used anywhere a phone is rendered to someone who
// is not the customer themselves.
const maskPhone = (raw) => {
  const d = normalizePhone(raw);
  if (!d) return '';
  return d.length <= 4 ? d : `${'•'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
};

module.exports = { normalizePhone, isValidPhone, maskPhone };
