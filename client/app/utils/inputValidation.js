// Shared input validation helpers — import what you need.

// Strips all non-digit chars; maxLen optionally truncates.
// Use for phone (10), pincode (6), aadhar (12) etc. in onChange.
export const digitsOnly = (value, maxLen) => {
  const d = String(value).replace(/\D/g, '');
  return maxLen ? d.slice(0, maxLen) : d;
};

// Removes whitespace and lowercases. Use in email onChange.
export const sanitizeEmail = (value) => String(value).replace(/\s/g, '').toLowerCase();

// Keeps only letters, spaces and . ' - so a name field can't hold an email,
// digits or symbols (the '@' is stripped as you type). Use in name onChange.
export const sanitizeName = (value) => String(value).replace(/[^\p{L}\s.'-]/gu, '');

// onKeyDown — blocks -, +, e, E, . so integer fields can't go negative or decimal.
export const blockNonInteger = (e) => {
  if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
};

// onKeyDown — blocks -, +, e, E but allows . (for price/amount with decimals).
export const blockNegative = (e) => {
  if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
};
