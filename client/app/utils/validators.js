// Reusable field validators + a tiny runner, so every form validates the same
// way instead of each page inventing its own ad-hoc checks (or none).
//
// Each validator is `(value, allValues) => string | null` — it returns a human
// error message, or null when the value is fine. Validators treat an EMPTY value
// as valid so they compose with `required`: use `[required(...), email]` when a
// field is mandatory, or just `[email]` when it is optional but must be valid
// when present.
//
// Usage in a submit handler:
//   const errors = runValidation(form, {
//     name:  [required('Name')],
//     email: [required('Email'), email],
//     phone: [required('Phone'), phone],
//     amount:[positiveAmount],
//   });
//   if (hasErrors(errors)) return toast.error(firstError(errors));
//   // ...proceed. Optionally show `errors[field]` inline under each input.

const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

// ── Presence ────────────────────────────────────────────────────────────────
export const required = (label = 'This field') => (v) =>
  isEmpty(v) ? `${label} is required` : null;

// A select/dropdown that must not be left on its empty/placeholder value.
export const requiredSelect = (label = 'This field') => (v) =>
  isEmpty(v) || v === 'all' ? `Please select ${label.toLowerCase()}` : null;

// ── Formats ───────────────────────────────────────────────────────────────
export const email = (v) => {
  if (isEmpty(v)) return null;
  // One @, a dot in the domain, no spaces — enough to catch real typos without
  // rejecting valid-but-unusual addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())
    ? null : 'Enter a valid email address';
};

export const phone = (v) => {
  if (isEmpty(v)) return null;
  const d = String(v).replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(d) ? null : 'Enter a valid 10-digit mobile number';
};

export const pincode = (v) => {
  if (isEmpty(v)) return null;
  return /^[1-9]\d{5}$/.test(String(v).replace(/\D/g, '')) ? null : 'Enter a valid 6-digit pincode';
};

export const aadhaar = (v) => {
  if (isEmpty(v)) return null;
  return /^\d{12}$/.test(String(v).replace(/\D/g, '')) ? null : 'Aadhaar must be 12 digits';
};

export const gstin = (v) => {
  if (isEmpty(v)) return null;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(String(v).trim())
    ? null : 'Enter a valid 15-character GSTIN';
};

// ── Numbers ─────────────────────────────────────────────────────────────────
export const positiveAmount = (v) => {
  if (isEmpty(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? null : 'Enter an amount greater than 0';
};

export const nonNegativeAmount = (v) => {
  if (isEmpty(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? null : 'Amount cannot be negative';
};

export const positiveInteger = (label = 'This') => (v) => {
  if (isEmpty(v)) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? null : `${label} must be a whole number greater than 0`;
};

export const numberInRange = (min, max, label = 'Value') => (v) => {
  if (isEmpty(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  return n >= min && n <= max ? null : `${label} must be between ${min} and ${max}`;
};

// Staff/admin age gate used across the people forms.
export const age = (v) => numberInRange(18, 99, 'Age')(v);

// ── Length ──────────────────────────────────────────────────────────────────
export const minLength = (n, label = 'This') => (v) => {
  if (isEmpty(v)) return null;
  return String(v).length >= n ? null : `${label} must be at least ${n} characters`;
};

export const maxLength = (n, label = 'This') => (v) => {
  if (isEmpty(v)) return null;
  return String(v).length <= n ? null : `${label} must be ${n} characters or fewer`;
};

// A password used when CREATING an account (matches the server's 10-char floor).
export const password = (v) => {
  if (isEmpty(v)) return null;
  return String(v).length >= 10 ? null : 'Password must be at least 10 characters';
};

// A date that must not be in the past (e.g. a coupon expiry).
export const futureDate = (label = 'Date') => (v) => {
  if (isEmpty(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return `${label} is invalid`;
  return d.getTime() > Date.now() ? null : `${label} must be in the future`;
};

// ── Runner ────────────────────────────────────────────────────────────────
/**
 * Run `rules` against `values`.
 * @param {Object} values
 * @param {Object} rules  { field: [validator, validator, …] }
 * @returns {Object} { field: firstErrorMessage } — only fields that failed.
 */
export const runValidation = (values = {}, rules = {}) => {
  const errors = {};
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const err = check(values[field], values);
      if (err) { errors[field] = err; break; } // first failure wins
    }
  }
  return errors;
};

export const hasErrors = (errors) => errors && Object.keys(errors).length > 0;
export const firstError = (errors) => (errors ? Object.values(errors)[0] : null) || null;
