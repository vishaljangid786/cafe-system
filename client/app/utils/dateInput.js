// Local calendar-date helpers for native <input type="date"> values.
//
// Using `new Date().toISOString().split('T')[0]` for "today" is a common bug: it
// returns the UTC date, which renders as the WRONG day for users in a non-UTC
// timezone (e.g. IST) — the calendar filter shows yesterday/tomorrow. These helpers
// format from the LOCAL calendar date instead, so the value always matches what the
// user sees on their own calendar.

export function toDateInput(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Today's date as a local YYYY-MM-DD string (safe default for date filters/inputs).
export const todayInput = () => toDateInput(new Date());

// Local YYYY-MM (for month pickers).
export function toMonthInput(date = new Date()) {
  const s = toDateInput(date);
  return s ? s.slice(0, 7) : '';
}
