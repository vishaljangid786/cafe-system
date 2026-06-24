const asyncHandler = require('../utils/asyncHandler');
const Settings = require('../models/Settings');
const { getSettings } = require('../utils/settings');
const { canAccessLocation } = require('../utils/accessControl');
const { logActivity } = require('../utils/auditLogger');

const GROUPS = ['tax', 'payroll', 'loyalty', 'invoice', 'billing', 'general'];

// @desc    Get effective settings (defaults < global < branch) for a branch
// @route   GET /api/settings
// @access  Private
const getEffectiveSettings = asyncHandler(async (req, res) => {
  let locationId = req.query.locationId || null;
  const branchScoped = ['staff', 'chef', 'branch_admin', 'location_admin'].includes(req.user.role);

  if (branchScoped) {
    // A multi-branch branch_admin may read any branch they can access; otherwise
    // (and for single-branch roles) fall back to their own assigned location.
    if (!(locationId && canAccessLocation(req.user, locationId))) {
      locationId = req.user.assignedLocation || null;
    }
  } else if (locationId && req.user.role !== 'super_admin' && !canAccessLocation(req.user, locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch settings');
  }

  const settings = await getSettings(locationId);
  res.json({ success: true, data: settings, locationId: locationId || null });
});

// @desc    Update settings for a branch (or global if super_admin, no locationId)
// @route   PUT /api/settings
// @access  Private (super_admin global/any; admin & branch_admin -> own branches)
const updateSettings = asyncHandler(async (req, res) => {
  const { locationId = null, ...groups } = req.body || {};

  if (locationId) {
    if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, locationId)) {
      res.status(403);
      throw new Error('You do not have access to this branch');
    }
  } else if (req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error('Only a super admin can edit the global default settings');
  }

  // For a BRANCH doc, only persist values that DIFFER from the global+default
  // baseline; values equal to the baseline are $unset so the branch keeps
  // inheriting them (a later change to the global default still propagates).
  // The global doc itself stores everything that is sent. (review: inheritance freeze)
  const baseline = locationId ? await getSettings(null) : null;
  const set = {};
  const unset = {};
  for (const g of GROUPS) {
    const grp = groups[g];
    if (grp && typeof grp === 'object' && !Array.isArray(grp)) {
      for (const [k, v] of Object.entries(grp)) {
        if (baseline && baseline[g] && JSON.stringify(baseline[g][k]) === JSON.stringify(v)) {
          unset[`${g}.${k}`] = '';
        } else {
          set[`${g}.${k}`] = v;
        }
      }
    }
  }

  const update = { $setOnInsert: { locationId: locationId || null } };
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;

  // No setDefaultsOnInsert: keep branch docs minimal (only real overrides) so
  // unset keys continue to inherit from global/defaults.
  const opts = { new: true, upsert: true, runValidators: true };
  let doc;
  try {
    doc = await Settings.findOneAndUpdate({ locationId: locationId || null }, update, opts);
  } catch (err) {
    // Unique index race (esp. two concurrent first-time global creates collapsing
    // to one doc) — re-apply onto the now-existing document.
    if (err.code === 11000) {
      doc = await Settings.findOneAndUpdate({ locationId: locationId || null }, update, { new: true, runValidators: true });
    } else {
      throw err;
    }
  }

  // logActivity swallows its own errors, so a logging failure never breaks the update.
  await logActivity(req.user, 'SETTINGS_UPDATE', `Updated ${locationId ? 'branch' : 'global'} settings`, req, { locationId: locationId || null });

  res.json({ success: true, data: doc });
});

module.exports = { getEffectiveSettings, updateSettings };
