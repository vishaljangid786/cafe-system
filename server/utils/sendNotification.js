const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIO } = require('../config/socket');
const { normalizeId } = require('./accessControl');

// Roles that MANAGE a branch and should hear about any change in it. Workers
// (staff / chef) are intentionally excluded — they already get the realtime
// order sockets and don't need the management activity feed.
const MANAGER_ROLES = ['admin', 'branch_admin', 'location_admin'];

/**
 * Persist + real-time deliver an "activity" notification for a change someone made.
 *
 * Recipients (deduplicated, never including the actor):
 *   • every super_admin (platform owners see all activity)
 *   • admins / branch_admins / location_admins WITH ACCESS to the affected branch
 *   • optionally a specific affected user (`notifyUserId`) — e.g. the user who was
 *     blocked, deactivated, or had their role / profile / permissions changed.
 *
 * Branch-scoped: managers of OTHER branches never receive it, so one cafe's
 * activity never leaks to another (tenant isolation). When no branch is known
 * (a global resource), only super_admins (+ the affected user) are notified.
 *
 * Best-effort: any failure is logged and swallowed so a notification problem can
 * never break the underlying business action.
 *
 * @param {Object}  params
 * @param {String}  params.title                Notification title
 * @param {String}  params.message              Notification body
 * @param {String}  [params.type='user_action'] Notification.type enum value
 * @param {String}  [params.priority='medium']  'low' | 'medium' | 'high'
 * @param {Object}  params.performedByUser       The actor (User doc); never notified about their own action
 * @param {String}  [params.locationId]          Affected branch; defaults to the actor's assignedLocation
 * @param {String}  [params.notifyUserId]        A specific user to also notify (the change's target)
 */
const sendNotification = async ({ title, message, type, priority, performedByUser, locationId, notifyUserId, targetOnly = false }) => {
  try {
    if (!performedByUser || !performedByUser._id) return;

    const actorId = normalizeId(performedByUser._id);
    const targetLocationId = normalizeId(locationId || performedByUser.assignedLocation);

    // Map keyed by id-string dedupes a manager who is also the affected user.
    const recipientIds = new Map();

    // targetOnly: notify ONLY the specific affected user (notifyUserId) — used for
    // private alerts like "someone logged into your account" that must NOT fan out
    // to every super_admin / branch manager.
    if (!targetOnly) {
      // super_admins always; branch managers only when a branch is known.
      const orConditions = [{ role: 'super_admin' }];
      if (targetLocationId) {
        orConditions.push({
          role: { $in: MANAGER_ROLES },
          $or: [
            { assignedLocation: targetLocationId },
            { accessibleLocations: targetLocationId },
          ],
        });
      }
      const managers = await User.find({ _id: { $ne: actorId }, $or: orConditions }).select('_id');
      managers.forEach((u) => recipientIds.set(u._id.toString(), u._id));
    }

    // The specifically-affected user (if any) — still exists and isn't the actor.
    if (notifyUserId) {
      const targetId = normalizeId(notifyUserId);
      if (targetId && targetId !== actorId) {
        const target = await User.findById(targetId).select('_id');
        if (target) recipientIds.set(target._id.toString(), target._id);
      }
    }

    if (recipientIds.size === 0) return;

    const recipientsList = [...recipientIds.values()].map((id) => ({ user: id, isRead: false }));

    const notification = await Notification.create({
      title,
      message,
      type: type || 'user_action',
      priority: priority || 'medium',
      sender: actorId,
      locationTarget: targetLocationId || undefined,
      recipients: recipientsList,
    });

    // Populate sender for the real-time payload (matches the GET /notifications shape).
    await notification.populate('sender', 'name email role profileImageUrl');

    // Emit ONLY to the actual recipients — each socket joins a room named after
    // its own user id (see server.js). This keeps the broadcast branch-isolated.
    const io = getIO();
    recipientsList.forEach(({ user }) => io.to(user.toString()).emit('new_notification', notification));
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

module.exports = sendNotification;
