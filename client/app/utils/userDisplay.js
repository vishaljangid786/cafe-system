// How a person is named on records that outlive them.
//
// Removing someone never deletes the orders, bills, expenses or payroll rows
// they touched — those have to keep reconciling. So historical screens still
// resolve a user, and need to say plainly that the person is gone rather than
// presenting them as current staff.
//
// Before this existed the codebase fell back to `user?.name || 'System'`, which
// quietly attributed a departed employee's work to an automated process.

export const REMOVED_LABEL = 'Removed user';

/**
 * Display name for a possibly-removed, possibly-absent user reference.
 *
 * @param {object|null} user      populated user (may carry `deletedAt`)
 * @param {string}      fallback  used only when there is genuinely no user —
 *                                an automated action. Defaults to 'System'.
 */
export const displayUserName = (user, fallback = 'System') => {
  if (!user) return fallback;
  if (!user.name) return fallback;
  return user.deletedAt ? `${user.name} (removed)` : user.name;
};

/** True when the reference points at somebody who has been removed. */
export const isRemovedUser = (user) => Boolean(user?.deletedAt);

/**
 * Initials for an avatar bubble. Returns a dash for removed people so their
 * monogram does not sit in a staff list looking active.
 */
export const userInitials = (user, fallback = '—') => {
  if (!user?.name) return fallback;
  if (user.deletedAt) return '—';
  return user.name.trim().slice(0, 2).toUpperCase();
};

/** Tailwind classes to grey out a removed person's name inline. */
export const removedNameClass = (user) =>
  user?.deletedAt ? 'text-(--color-text-muted) italic' : '';
