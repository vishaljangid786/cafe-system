const asyncHandler = require('../utils/asyncHandler');
const Cafe = require('../models/Cafe');
const User = require('../models/User');
const Location = require('../models/Location');
const { logActivity } = require('../utils/auditLogger');
const { addAdminToCafe, removeAdminFromCafe } = require('../utils/cafeSync');
const { canAccessLocation } = require('../utils/accessControl');
const sendNotification = require('../utils/sendNotification');

// A cafe owner gets full control over everything inside their cafe (branches,
// staff, menu, revenue, audit, admin center). Platform-only powers
// (impersonateUsers, sendGlobalNotifications) stay with the super_admin.
const CAFE_ADMIN_PERMISSIONS = {
  viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
  forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true,
  viewAnalytics: true, manageCoupons: true, manageBranches: true, viewAuditLogs: true,
  viewAdminCenter: true, manageGlobalMenu: true, sendMessages: true, messageSuperAdmin: true,
};

// Every grantable permission flag (mirrors the User schema + Add-Member form).
const ALL_PERMISSION_KEYS = [
  'viewRevenue', 'editRevenue', 'viewOrders', 'manageOrders', 'forceComplete',
  'exportReports', 'manageStaff', 'manageNotifications', 'viewAnalytics', 'manageCoupons',
  'manageBranches', 'viewAuditLogs', 'impersonateUsers', 'viewAdminCenter',
  'manageGlobalMenu', 'sendGlobalNotifications', 'sendMessages', 'messageSuperAdmin',
];

// Build a clean permission object from a (possibly stringified / partial) input.
// Only super_admins create cafe admins, so any requested flag is allowed; we just
// fall back to the full cafe-admin default set when nothing usable is sent.
const resolveAdminPermissions = (requested) => {
  let req = requested;
  if (typeof req === 'string') {
    try { req = JSON.parse(req); } catch (e) { req = null; }
  }
  if (!req || typeof req !== 'object') return { ...CAFE_ADMIN_PERMISSIONS };
  const perms = {};
  ALL_PERMISSION_KEYS.forEach((k) => { perms[k] = req[k] === true; });
  // Messaging master switch defaults ON unless explicitly disabled.
  perms.sendMessages = req.sendMessages !== false;
  return perms;
};

const userCafeIds = (user) => (user?.cafes || []).map((c) => c.toString());

const canAccessCafe = (user, cafeId) => {
  if (!user || !cafeId) return false;
  if (user.role === 'super_admin') return true;
  return userCafeIds(user).includes(cafeId.toString());
};

// Resolve the cafe ids a (non-super) user is associated with: cafes they admin,
// or — for branch-level roles — the cafe of their assigned branch.
const resolveUserCafeIds = async (user) => {
  const ids = new Set(userCafeIds(user));
  if (ids.size === 0 && user.assignedLocation) {
    const loc = await Location.findById(user.assignedLocation).select('cafe').lean();
    if (loc?.cafe) ids.add(loc.cafe.toString());
  }
  return [...ids];
};

// @desc    List cafes visible to the caller
// @route   GET /api/cafes        (?branchId=… → just the cafe that owns that branch)
const getCafes = asyncHandler(async (req, res) => {
  const filter = { status: { $ne: 'deleted' } };

  // Branding lookup for a specific branch (used by the receipt/bill preview). Any
  // user who can access the branch can read its cafe's branding.
  if (req.query.branchId) {
    // Only a user who can actually access this branch may read its cafe's branding.
    // Without this check, any authenticated user could enumerate branch ObjectIds
    // and read another tenant's full cafe record (GSTIN, address, contact). Branch-
    // level access (not cafe membership) is used so branch staff/chef printing bills
    // still resolve their own branding. super_admin passes via canAccessLocation.
    if (!canAccessLocation(req.user, req.query.branchId)) {
      return res.json({ success: true, data: [] });
    }
    const branch = await Location.findById(req.query.branchId).select('cafe').lean();
    if (!branch?.cafe) return res.json({ success: true, data: [] });
    const cafe = await Cafe.findOne({ _id: branch.cafe, status: { $ne: 'deleted' } }).lean();
    return res.json({ success: true, data: cafe ? [cafe] : [] });
  }

  if (req.user.role !== 'super_admin') {
    const ids = await resolveUserCafeIds(req.user);
    if (ids.length === 0) return res.json({ success: true, data: [] });
    filter._id = { $in: ids };
  }

  const cafes = await Cafe.find(filter).sort({ createdAt: -1 }).lean();
  const cafeIds = cafes.map((c) => c._id);

  const [branchCounts, admins] = await Promise.all([
    Location.aggregate([
      { $match: { cafe: { $in: cafeIds }, isPermanentlyDeleted: { $ne: true } } },
      { $group: { _id: '$cafe', count: { $sum: 1 } } },
    ]),
    User.find({ role: 'admin', cafes: { $in: cafeIds }, deletedAt: null }).select('name email cafes').lean(),
  ]);

  const branchMap = new Map(branchCounts.map((b) => [b._id.toString(), b.count]));
  const adminMap = {};
  admins.forEach((a) =>
    (a.cafes || []).forEach((cid) => {
      const k = cid.toString();
      (adminMap[k] = adminMap[k] || []).push({ _id: a._id, name: a.name, email: a.email });
    })
  );

  const data = cafes.map((c) => ({
    ...c,
    branchCount: branchMap.get(c._id.toString()) || 0,
    admins: adminMap[c._id.toString()] || [],
  }));

  res.json({ success: true, data });
});

// @desc    Get a single cafe with its branches + admins
// @route   GET /api/cafes/:id
const getCafe = asyncHandler(async (req, res) => {
  const cafe = await Cafe.findById(req.params.id).lean();
  if (!cafe || cafe.status === 'deleted') {
    res.status(404);
    throw new Error('Cafe not found');
  }
  if (!canAccessCafe(req.user, cafe._id)) {
    res.status(403);
    throw new Error('You do not have access to this cafe');
  }

  const [branches, admins] = await Promise.all([
    Location.find({ cafe: cafe._id, isPermanentlyDeleted: { $ne: true } })
      .select('name city status maxCapacity').lean(),
    User.find({ role: 'admin', cafes: cafe._id, deletedAt: null }).select('name email phone').lean(),
  ]);

  res.json({ success: true, data: { ...cafe, branches, admins } });
});

// Create or attach an admin to a cafe. Returns the admin user (or null).
const attachAdmin = async (req, cafe, { adminMode, admin, adminUserId }) => {
  if (adminMode === 'new' && admin) {
    const email = String(admin.email || '').trim().toLowerCase();
    const dupe = await User.findOne({ email });
    if (dupe) {
      const err = new Error('A user with this email already exists');
      err.statusCode = 400;
      throw err;
    }
    // Full member parity (mirrors the Add-Member page): identity, address,
    // qualification, salary, Aadhaar, profile photo, and the full permission set.
    const created = await User.create({
      name: admin.name,
      email,
      password: admin.password,
      phone: admin.phone,
      gender: admin.gender || 'Other',
      age: admin.age || undefined,
      address1: admin.address1 || 'N/A',
      address2: admin.address2 || '',
      city: admin.city || cafe.address?.city || 'N/A',
      state: admin.state || cafe.address?.state || '',
      country: admin.country || 'India',
      pincode: admin.pincode || undefined,
      highestQualification: admin.highestQualification || '12th Pass',
      monthlySalary: admin.monthlySalary || 0,
      aadharNumber: admin.aadharNumber || undefined,
      aadharImage: admin.aadharImage || '',
      profileImageUrl: admin.profileImageUrl || '',
      role: 'admin',
      permissions: resolveAdminPermissions(admin.permissions),
    });
    // Mirror cafe membership + all existing branches into accessibleLocations.
    await addAdminToCafe(cafe._id, created._id);
    return created;
  }

  if (adminMode === 'existing' && adminUserId) {
    const user = await User.findById(adminUserId);
    if (!user) {
      const err = new Error('Selected user not found');
      err.statusCode = 404;
      throw err;
    }
    // Only an existing ADMIN can be assigned to (another) cafe. To turn a staff
    // member into a cafe owner, use "Create a new admin account" instead.
    if (user.role !== 'admin') {
      const err = new Error('Only existing admins can be assigned. Use "Create a new admin account" for anyone else.');
      err.statusCode = 400;
      throw err;
    }
    // Grant the cafe-management permissions and drop any single-branch pointer
    // (admins are cafe-scoped). Use a TARGETED updateOne — NOT user.save() — so we
    // don't re-validate the existing (possibly legacy/seeded) document. A full
    // re-validation would fail on stale data such as an Aadhaar number that was
    // encrypted under a different ENCRYPTION_KEY, blocking the assignment entirely.
    const permSet = {};
    Object.entries(CAFE_ADMIN_PERMISSIONS).forEach(([k, v]) => { permSet[`permissions.${k}`] = v; });
    await User.updateOne({ _id: user._id }, { $set: permSet, $unset: { assignedLocation: 1 } });
    // Record membership + mirror the cafe's branches into accessibleLocations.
    await addAdminToCafe(cafe._id, user._id);
    return user;
  }

  return null;
};

// @desc    Create a cafe (+ optionally its first admin)
// @route   POST /api/cafes   (super_admin)
const createCafe = asyncHandler(async (req, res) => {
  const { name, logo, gstin, address, contact } = req.body;

  const exists = await Cafe.findOne({
    name: String(name || '').trim(),
    status: { $ne: 'deleted' },
  });
  if (exists) {
    res.status(400);
    throw new Error('A cafe with this name already exists');
  }

  const cafe = await Cafe.create({
    name,
    slug: Cafe.slugify(name),
    logo: logo || '',
    gstin: gstin || '',
    address: address || {},
    contact: contact || {},
    createdBy: req.user._id,
  });

  let createdAdmin = null;
  try {
    createdAdmin = await attachAdmin(req, cafe, req.body);
  } catch (err) {
    // Roll back the cafe so a failed admin step doesn't leave an orphan cafe.
    try { await Cafe.deleteOne({ _id: cafe._id }); } catch (rollbackError) {
      console.error('[createCafe] rollback failed:', rollbackError.message);
    }
    throw err;
  }

  await logActivity(req.user, 'CAFE_CREATE', `Created cafe: ${cafe.name}`, req, { cafeId: cafe._id });

  await sendNotification({
    title: 'Cafe Created',
    message: `Cafe ${cafe.name} was created by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
  });

  res.status(201).json({
    success: true,
    data: {
      ...cafe.toObject(),
      branchCount: 0,
      admins: createdAdmin
        ? [{ _id: createdAdmin._id, name: createdAdmin.name, email: createdAdmin.email }]
        : [],
    },
  });
});

// @desc    Update cafe details / branding
// @route   PATCH /api/cafes/:id   (super_admin or a cafe admin)
const updateCafe = asyncHandler(async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe || cafe.status === 'deleted') {
    res.status(404);
    throw new Error('Cafe not found');
  }
  if (!canAccessCafe(req.user, cafe._id)) {
    res.status(403);
    throw new Error('You do not have access to this cafe');
  }

  const { name, logo, gstin, address, contact, status } = req.body;

  if (name !== undefined && name !== cafe.name) {
    const clash = await Cafe.findOne({ name: String(name).trim(), _id: { $ne: cafe._id }, status: { $ne: 'deleted' } });
    if (clash) {
      res.status(400);
      throw new Error('A cafe with this name already exists');
    }
    cafe.name = name;
    cafe.slug = Cafe.slugify(name);
  }
  if (logo !== undefined) cafe.logo = logo;
  if (gstin !== undefined) cafe.gstin = gstin;
  if (address && typeof address === 'object') cafe.address = { ...cafe.address?.toObject?.() ?? cafe.address, ...address };
  if (contact && typeof contact === 'object') cafe.contact = { ...cafe.contact?.toObject?.() ?? cafe.contact, ...contact };
  // Only a super_admin may activate/deactivate a whole cafe.
  if (status !== undefined && req.user.role === 'super_admin' && ['active', 'inactive'].includes(status)) {
    cafe.status = status;
  }

  await cafe.save();
  await logActivity(req.user, 'CAFE_UPDATE', `Updated cafe: ${cafe.name}`, req, { cafeId: cafe._id });

  await sendNotification({
    title: 'Cafe Updated',
    message: `Cafe ${cafe.name} was updated by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
  });

  res.json({ success: true, data: cafe });
});

// @desc    Add an admin to a cafe (new inline OR existing user)
// @route   POST /api/cafes/:id/admins   (super_admin)
const addCafeAdmin = asyncHandler(async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe || cafe.status === 'deleted') {
    res.status(404);
    throw new Error('Cafe not found');
  }

  let admin;
  try {
    admin = await attachAdmin(req, cafe, req.body);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }
  if (!admin) {
    res.status(400);
    throw new Error('Provide a new admin (adminMode "new") or an existing user (adminMode "existing")');
  }

  await logActivity(req.user, 'CAFE_ADMIN_ADD', `Added admin ${admin.name} to cafe ${cafe.name}`, req, { cafeId: cafe._id, targetUserId: admin._id });

  await sendNotification({
    title: 'Cafe Admin Added',
    message: `Admin ${admin.name} was added to cafe ${cafe.name} by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    notifyUserId: admin._id,
  });

  res.status(201).json({ success: true, data: { _id: admin._id, name: admin.name, email: admin.email } });
});

// @desc    Remove an admin from a cafe
// @route   DELETE /api/cafes/:id/admins/:userId   (super_admin)
const removeCafeAdmin = asyncHandler(async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe || cafe.status === 'deleted') {
    res.status(404);
    throw new Error('Cafe not found');
  }

  // Verify the target is actually an admin of THIS cafe before removing.
  const target = await User.findById(req.params.userId).select('role cafes');
  if (!target) {
    res.status(404);
    throw new Error('User not found');
  }
  const isMember = (target.cafes || []).some((c) => c.toString() === cafe._id.toString());
  if (!isMember) {
    res.status(400);
    throw new Error('This user is not an admin of this cafe');
  }

  await removeAdminFromCafe(cafe._id, req.params.userId);
  // Note: a user left administering NO cafe stays role 'admin' with empty cafes[]
  // (they simply see nothing) — we don't auto-downgrade, since 'staff' would
  // require an assignedLocation the user may not have. A super-admin can reassign
  // or delete them explicitly.

  await logActivity(req.user, 'CAFE_ADMIN_REMOVE', `Removed an admin from cafe ${cafe.name}`, req, { cafeId: cafe._id, targetUserId: req.params.userId });

  await sendNotification({
    title: 'Cafe Admin Removed',
    message: `An admin was removed from cafe ${cafe.name} by ${req.user.name}.`,
    type: 'user_action',
    performedByUser: req.user,
    notifyUserId: req.params.userId,
  });

  res.json({ success: true, message: 'Admin removed from cafe' });
});

// @desc    Everything a cafe deletion would touch
// @route   GET /api/cafes/:id/impact   (super_admin)
const getCafeImpact = asyncHandler(async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe || cafe.status === 'deleted') {
    res.status(404);
    throw new Error('Cafe not found');
  }

  const { previewCafeImpact } = require('../services/cascadeDelete');
  const impact = await previewCafeImpact(cafe._id);

  res.json({ success: true, data: { ...impact, subject: { type: 'cafe', id: String(cafe._id), name: cafe.name } } });
});

// @desc    Delete a cafe
// @route   DELETE /api/cafes/:id   (super_admin)
//
// Without `force` the original guard stands: branches must be cleared first.
// With `force` (super_admin only) the cafe goes along with its branches and all
// of their configuration in one pass. Financial and audit records never go —
// see `dependencyGraph.js` — so revenue history keeps reconciling afterwards.
const deleteCafe = asyncHandler(async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe || cafe.status === 'deleted') {
    res.status(404);
    throw new Error('Cafe not found');
  }

  const force = req.body?.force === true || req.query?.force === 'true';
  // `staffMode: 'delete'` removes the cafe's people too; the default keeps them
  // and merely detaches the dead cafe from their access lists.
  const staffMode = req.body?.staffMode === 'delete' ? 'delete' : 'detach';

  if (force && req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error('Only a Super Admin can force-delete a cafe with its branches');
  }

  const branchCount = await Location.countDocuments({
    cafe: cafe._id,
    isPermanentlyDeleted: { $ne: true },
    status: { $ne: 'deleted' },
  });

  if (branchCount > 0 && !force) {
    res.status(400);
    throw new Error('This cafe still has branches. Remove or reassign them before deleting the cafe.');
  }

  let summary = { performed: [], branchCount: 0, staffAffected: 0 };

  if (force) {
    const { executeCafePurge } = require('../services/cascadeDelete');
    summary = await executeCafePurge(cafe._id, { actorId: req.user._id, staffMode });
  } else {
    cafe.status = 'deleted';
    await cafe.save();
    // Detach every admin AND prune the cafe's branch ids from their
    // accessibleLocations (keeping branches still reachable via another cafe).
    const affected = await User.find({ cafes: cafe._id }).select('_id').lean();
    for (const u of affected) {
      await removeAdminFromCafe(cafe._id, u._id);
    }
  }

  // A deleted cafe must drop out of the suspended-cafe cache, or its (now
  // absent) users would keep being told the cafe is merely blocked.
  require('../utils/tenantStatus').invalidateTenantCache();

  await logActivity(
    req.user,
    'CAFE_DELETE',
    `Deleted cafe: ${cafe.name}${force ? ` (forced, ${summary.branchCount} branch(es))` : ''}`,
    req,
    { cafeId: cafe._id, force, staffMode, removed: summary.performed }
  );

  await sendNotification({
    title: 'Cafe Deleted',
    message: `Cafe ${cafe.name} was deleted by ${req.user.name}.`,
    type: 'activity',
    priority: 'high',
    performedByUser: req.user,
  });

  res.json({
    success: true,
    message: force
      ? `${cafe.name} and ${summary.branchCount} branch(es) were deleted. Financial and audit records were preserved.`
      : 'Cafe deleted',
    data: summary,
  });
});

// @desc    Block or unblock an entire cafe
// @route   PATCH /api/cafes/:id/suspension   (super_admin)
//
// A blocked cafe is frozen end to end: nobody who belongs to it can use the
// dashboard, live sockets are dropped, and its public QR menu and bookings stop
// serving. Only a super_admin can lift it.
const setCafeSuspension = asyncHandler(async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe || cafe.status === 'deleted') {
    res.status(404);
    throw new Error('Cafe not found');
  }

  const suspend = req.body?.suspended === true;
  const reason = String(req.body?.reason || '').trim().slice(0, 300);

  if (suspend && cafe.status === 'suspended') {
    res.status(400);
    throw new Error('This cafe is already blocked');
  }
  if (!suspend && cafe.status !== 'suspended') {
    res.status(400);
    throw new Error('This cafe is not blocked');
  }

  cafe.status = suspend ? 'suspended' : 'active';
  cafe.suspendedAt = suspend ? new Date() : null;
  cafe.suspendedBy = suspend ? req.user._id : null;
  cafe.suspendedReason = suspend ? reason : '';
  await cafe.save();

  // Take effect on this instance immediately rather than after the cache TTL.
  require('../utils/tenantStatus').invalidateTenantCache();

  // Drop live sockets so an open dashboard stops receiving events at once,
  // instead of lingering until its next HTTP request hits the gate.
  if (suspend) {
    try {
      const branchIds = (await Location.find({ cafe: cafe._id }).select('_id').lean()).map((l) => l._id);
      const victims = await User.find({
        deletedAt: null,
        role: { $ne: 'super_admin' },
        $or: [
          { cafes: cafe._id },
          { assignedLocation: { $in: branchIds } },
          { accessibleLocations: { $in: branchIds } },
        ],
      })
        .select('_id')
        .lean();
      const { disconnectUser } = require('../config/socket');
      victims.forEach((u) => disconnectUser(u._id));
    } catch {
      // The HTTP gate is authoritative; losing the socket sweep only delays the
      // lock for an idle tab, so it must never fail the suspension itself.
    }
  }

  await logActivity(
    req.user,
    suspend ? 'CAFE_SUSPENDED' : 'CAFE_UNSUSPENDED',
    `${suspend ? 'Blocked' : 'Unblocked'} cafe: ${cafe.name}${reason ? ` — ${reason}` : ''}`,
    req,
    { cafeId: cafe._id, reason }
  );

  res.json({
    success: true,
    message: suspend ? `${cafe.name} is now blocked` : `${cafe.name} is active again`,
    data: {
      status: cafe.status,
      suspendedAt: cafe.suspendedAt,
      suspendedReason: cafe.suspendedReason,
    },
  });
});

// @desc    Upload a cafe logo image → returns the hosted URL (used by the
//          create/edit forms; keeps the JSON create/update endpoints simple).
// @route   POST /api/cafes/upload-logo   (super_admin or admin)
const uploadCafeLogo = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.path) {
    res.status(400);
    throw new Error('No image uploaded');
  }
  res.status(201).json({ success: true, url: req.file.path });
});

module.exports = {
  getCafes,
  getCafe,
  createCafe,
  updateCafe,
  addCafeAdmin,
  removeCafeAdmin,
  deleteCafe,
  getCafeImpact,
  setCafeSuspension,
  uploadCafeLogo,
  canAccessCafe,
  resolveUserCafeIds,
  CAFE_ADMIN_PERMISSIONS,
};
