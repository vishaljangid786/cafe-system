// ---------------------------------------------------------------------------
// The single gate every "delete one record" endpoint goes through.
//
// Deleting a specific row (an order, a revenue entry, an expense, an attendance
// mark…) has to answer TWO independent questions, and getting either wrong is a
// security bug:
//
//   1. MAY THIS PERSON DELETE THIS KIND OF THING?
//      Answered by the three-layer action model (utils/actionPermissions.js):
//      super_admin, OR legacy role, OR legacy broad permission, OR the granular
//      `${scope}.delete` flag. Routes already apply this via `checkAction`, and
//      `assertCanDelete` re-checks it so a controller reached by any other path
//      (internal call, future route, mounted twice) can never skip it.
//
//   2. IS THIS PARTICULAR RECORD INSIDE THEIR SCOPE?
//      A branch admin holding `expenses.delete` may delete expenses — but only
//      the ones belonging to a branch they can reach. Route middleware cannot
//      answer this: it doesn't know which record the id resolves to. So it is
//      answered HERE, after the document is loaded.
//
// Both failures produce a specific, actionable message naming the resource,
// never a bare "Forbidden" — the operator should always learn WHICH rule
// stopped them and what would let them through.
//
// Usage in a controller:
//
//   const doc = await requireRecord(res, await Expense.findById(req.params.id), 'Expense');
//   assertCanDelete(req, res, { resource: 'expense', actionKey: 'expenses.delete', locationId: doc.locationId });
//   await doc.deleteOne();
//   await announceDeletion(req, { resource: 'Expense', name: doc.title, locationId: doc.locationId, action: 'EXPENSE_DELETE' });
// ---------------------------------------------------------------------------

const { userCanAct } = require('./actionPermissions');
const { canAccessLocation, normalizeId } = require('./accessControl');
const sendNotification = require('./sendNotification');
const { logAction } = require('./auditLogger');

// Roles that may act on records with no branch of their own (a cafe-wide menu
// item, a global coupon, a category). Anything narrower has no branch to check
// against, so ownership falls back to the org level.
const DEFAULT_GLOBAL_ROLES = ['super_admin', 'admin'];

/**
 * 404 with a resource-specific message, so the client never shows a bare
 * "Not found" for a record the user just clicked.
 *
 * @param {Object} res      Express response
 * @param {Object} doc      The loaded document (or null)
 * @param {String} resource Human name, e.g. 'Expense'
 * @returns the document, so this can wrap the query inline
 */
const requireRecord = (res, doc, resource = 'Record') => {
  if (!doc) {
    res.status(404);
    throw new Error(`${resource} not found. It may have already been deleted.`);
  }
  return doc;
};

/**
 * Authorize deleting ONE specific record.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Object}  opts
 * @param {String}  opts.resource        Human name for messages, e.g. 'expense'
 * @param {String}  opts.actionKey       Granular action, e.g. 'expenses.delete'
 * @param {String}  [opts.locationId]    The branch this record belongs to. When
 *                                       present, the actor must be able to reach it.
 * @param {Array}   [opts.globalRoles]   Roles allowed when the record has NO branch.
 * @param {String}  [opts.ownerId]       When set, a user who lacks the action may
 *                                       still delete their OWN record (used for
 *                                       self-service rows like a leave request).
 */
const assertCanDelete = (req, res, { resource = 'record', actionKey, locationId, globalRoles = DEFAULT_GLOBAL_ROLES, ownerId } = {}) => {
  const user = req.user;
  if (!user) {
    res.status(401);
    throw new Error('Please login to continue');
  }

  const isOwnRecord = ownerId && normalizeId(ownerId) === normalizeId(user._id);

  // Gate 1 — permission to delete this KIND of thing.
  if (actionKey && !userCanAct(user, actionKey) && !isOwnRecord) {
    console.error(`[DELETE_DENIED] ${user.name} (${user.role}) lacks ${actionKey}`);
    res.status(403);
    throw new Error(
      `You do not have permission to delete ${resource}s. Ask an administrator to grant you the "delete" permission for this section.`
    );
  }

  // Gate 2 — is THIS record inside their scope?
  if (locationId) {
    if (!canAccessLocation(user, locationId) && !isOwnRecord) {
      console.error(`[DELETE_DENIED] ${user.name} (${user.role}) is outside branch ${normalizeId(locationId)}`);
      res.status(403);
      throw new Error(
        `This ${resource} belongs to a branch you do not manage. You can only delete ${resource}s from your own branches.`
      );
    }
  } else if (!isOwnRecord && user.role !== 'super_admin' && !globalRoles.includes(user.role)) {
    // No branch on the record → it is cafe-wide / global.
    res.status(403);
    throw new Error(
      `This ${resource} is shared across branches, so only a cafe administrator can delete it.`
    );
  }

  return true;
};

/**
 * Tell everyone who should know that something was deleted, and write the audit
 * row — the two things that must never be forgotten after a destructive action.
 *
 * `sendNotification` already fans out to every super_admin plus the managers of
 * the affected branch (so a branch admin's delete is visible to their admin and
 * the super admin — "superiors always know"). `notifyUserIds` adds the people
 * the deletion happened TO, who are usually not managers.
 *
 * Best-effort by construction: neither a notification nor an audit failure may
 * roll back a delete that already happened.
 *
 * @param {Object} req
 * @param {Object}  opts
 * @param {String}  opts.resource        e.g. 'Expense'
 * @param {String}  [opts.name]          identifying label, e.g. the title
 * @param {String}  [opts.locationId]    branch the record belonged to
 * @param {String}  opts.action          audit action code, e.g. 'EXPENSE_DELETE'
 * @param {Array}   [opts.notifyUserIds] people directly affected
 * @param {String}  [opts.type]          Notification type enum
 * @param {String}  [opts.priority]
 * @param {Object}  [opts.metadata]      extra audit context
 * @param {String}  [opts.detail]        extra sentence appended to the message
 */
const announceDeletion = async (
  req,
  { resource, name, locationId, action, notifyUserIds, type = 'activity', priority = 'high', metadata = {}, detail = '' } = {}
) => {
  const label = name ? `"${name}"` : '';
  const actor = req.user?.name || 'Someone';
  const message = `${resource} ${label} was deleted by ${actor} (${(req.user?.role || '').replace(/_/g, ' ')}).${detail ? ` ${detail}` : ''}`;

  await sendNotification({
    title: `${resource} Deleted`,
    message,
    type,
    priority,
    performedByUser: req.user,
    locationId,
    notifyUserIds,
  });

  await logAction(
    req,
    action || `${String(resource).toUpperCase().replace(/\s+/g, '_')}_DELETE`,
    { resource, name, locationId: locationId ? normalizeId(locationId) : null, ...metadata }
  );
};

module.exports = {
  requireRecord,
  assertCanDelete,
  announceDeletion,
  DEFAULT_GLOBAL_ROLES,
};
