const PermissionPreset = require('../models/PermissionPreset');
const asyncHandler = require('../utils/asyncHandler');

const PERMISSION_KEYS = [
  'viewRevenue', 'editRevenue', 'viewOrders', 'manageOrders', 'forceComplete',
  'exportReports', 'manageStaff', 'manageNotifications', 'viewAnalytics', 'manageCoupons',
];

// Keep only the known permission keys as strict booleans.
const sanitizePermissions = (input = {}) => {
  const out = {};
  PERMISSION_KEYS.forEach((k) => { out[k] = input[k] === true; });
  return out;
};

// A non-super-admin can only put permissions in a preset that they themselves hold.
const assertSubsetOfActor = (req, res, permissions) => {
  if (req.user.role === 'super_admin') return;
  const actor = req.user.permissions || {};
  const offending = PERMISSION_KEYS.filter((k) => permissions[k] && !actor[k]);
  if (offending.length) {
    res.status(403);
    throw new Error(`You cannot include permissions you do not have: ${offending.join(', ')}`);
  }
};

const canModify = (req, preset) =>
  req.user.role === 'super_admin' || preset.createdBy?.toString() === req.user._id.toString();

// @desc    List all permission presets (custom roles)
// @route   GET /api/permission-presets
const getPresets = asyncHandler(async (req, res) => {
  const presets = await PermissionPreset.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: presets });
});

// @desc    Create a permission preset
// @route   POST /api/permission-presets
const createPreset = asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    res.status(400);
    throw new Error('Role name is required');
  }
  const permissions = sanitizePermissions(req.body.permissions);
  assertSubsetOfActor(req, res, permissions);

  const preset = await PermissionPreset.create({
    name,
    permissions,
    createdBy: req.user._id,
    createdByName: req.user.name,
  });

  res.status(201).json({ success: true, data: preset });
});

// @desc    Update a permission preset
// @route   PUT /api/permission-presets/:id
const updatePreset = asyncHandler(async (req, res) => {
  const preset = await PermissionPreset.findById(req.params.id);
  if (!preset) {
    res.status(404);
    throw new Error('Role not found');
  }
  if (!canModify(req, preset)) {
    res.status(403);
    throw new Error('You can only edit roles you created');
  }

  if (req.body.name !== undefined) {
    const name = (req.body.name || '').trim();
    if (!name) {
      res.status(400);
      throw new Error('Role name is required');
    }
    preset.name = name;
  }

  if (req.body.permissions !== undefined) {
    const permissions = sanitizePermissions(req.body.permissions);
    assertSubsetOfActor(req, res, permissions);
    preset.permissions = permissions;
  }

  await preset.save();
  res.json({ success: true, data: preset });
});

// @desc    Delete a permission preset
// @route   DELETE /api/permission-presets/:id
const deletePreset = asyncHandler(async (req, res) => {
  const preset = await PermissionPreset.findById(req.params.id);
  if (!preset) {
    res.status(404);
    throw new Error('Role not found');
  }
  if (!canModify(req, preset)) {
    res.status(403);
    throw new Error('You can only delete roles you created');
  }

  await preset.deleteOne();
  res.json({ success: true, message: 'Role deleted' });
});

module.exports = { getPresets, createPreset, updatePreset, deletePreset };
