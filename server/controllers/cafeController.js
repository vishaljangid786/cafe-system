const asyncHandler = require('../utils/asyncHandler');
const Cafe = require('../models/Cafe');
const User = require('../models/User');
const Location = require('../models/Location');
const { logActivity } = require('../utils/auditLogger');
const { addAdminToCafe, removeAdminFromCafe, syncCafeAccess } = require('../utils/cafeSync');

// A cafe owner gets full control over everything inside their cafe (branches,
// staff, menu, revenue, audit, admin center). Platform-only powers
// (impersonateUsers, sendGlobalNotifications) stay with the super_admin.
const CAFE_ADMIN_PERMISSIONS = {
  viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
  forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true,
  viewAnalytics: true, manageCoupons: true, manageBranches: true, viewAuditLogs: true,
  viewAdminCenter: true, manageGlobalMenu: true, sendMessages: true, messageSuperAdmin: true,
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
    User.find({ role: 'admin', cafes: { $in: cafeIds } }).select('name email cafes').lean(),
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
    User.find({ role: 'admin', cafes: cafe._id }).select('name email phone').lean(),
  ]);

  res.json({ success: true, data: { ...cafe, branches, admins } });
});

// Create or attach an admin to a cafe. Returns the admin user (or null).
const attachAdmin = async (req, cafe, { adminMode, admin, adminUserId }) => {
  if (adminMode === 'new' && admin) {
    const email = String(admin.email || '').trim();
    const dupe = await User.findOne({ email });
    if (dupe) {
      const err = new Error('A user with this email already exists');
      err.statusCode = 400;
      throw err;
    }
    const created = await User.create({
      name: admin.name,
      email,
      password: admin.password,
      phone: admin.phone,
      gender: admin.gender || 'Other',
      age: admin.age || undefined,
      address1: admin.address1 || 'N/A',
      city: admin.city || cafe.address?.city || 'N/A',
      state: admin.state || cafe.address?.state || '',
      role: 'admin',
      cafes: [cafe._id],
      permissions: CAFE_ADMIN_PERMISSIONS,
    });
    return created;
  }

  if (adminMode === 'existing' && adminUserId) {
    const user = await User.findById(adminUserId);
    if (!user) {
      const err = new Error('Selected user not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.role === 'super_admin') {
      const err = new Error('A super-admin cannot be assigned as a cafe admin');
      err.statusCode = 400;
      throw err;
    }
    user.role = 'admin';
    user.permissions = { ...(user.permissions || {}), ...CAFE_ADMIN_PERMISSIONS };
    await user.save();
    // Record membership + mirror the cafe's branches into accessibleLocations.
    await addAdminToCafe(cafe._id, user._id);
    return user;
  }

  return null;
};

// @desc    Create a cafe (+ optionally its first admin)
// @route   POST /api/cafes   (super_admin)
const createCafe = asyncHandler(async (req, res) => {
  const { name, logo, gstin, address, contact, adminMode } = req.body;

  const exists = await Cafe.findOne({ name: String(name || '').trim(), status: { $ne: 'deleted' } });
  if (exists) {
    res.status(400);
    throw new Error('A cafe with this name already exists');
  }

  const cafe = await Cafe.create({
    name,
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
    await Cafe.deleteOne({ _id: cafe._id });
    throw err;
  }

  await logActivity(req.user, 'CAFE_CREATE', `Created cafe: ${cafe.name}`, req, { cafeId: cafe._id });

  res.status(201).json({
    success: true,
    data: {
      ...cafe.toObject(),
      branchCount: 0,
      admins: createdAdmin ? [{ _id: createdAdmin._id, name: createdAdmin.name, email: createdAdmin.email }] : [],
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

  const admin = await attachAdmin(req, cafe, req.body);
  if (!admin) {
    res.status(400);
    throw new Error('Provide a new admin (adminMode "new") or an existing user (adminMode "existing")');
  }

  await logActivity(req.user, 'CAFE_ADMIN_ADD', `Added admin ${admin.name} to cafe ${cafe.name}`, req, { cafeId: cafe._id, targetUserId: admin._id });

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

  await removeAdminFromCafe(cafe._id, req.params.userId);
  await logActivity(req.user, 'CAFE_ADMIN_REMOVE', `Removed an admin from cafe ${cafe.name}`, req, { cafeId: cafe._id, targetUserId: req.params.userId });

  res.json({ success: true, message: 'Admin removed from cafe' });
});

// @desc    Soft-delete a cafe (must have no active branches first)
// @route   DELETE /api/cafes/:id   (super_admin)
const deleteCafe = asyncHandler(async (req, res) => {
  const cafe = await Cafe.findById(req.params.id);
  if (!cafe || cafe.status === 'deleted') {
    res.status(404);
    throw new Error('Cafe not found');
  }

  const branchCount = await Location.countDocuments({
    cafe: cafe._id,
    isPermanentlyDeleted: { $ne: true },
    status: { $ne: 'deleted' },
  });
  if (branchCount > 0) {
    res.status(400);
    throw new Error('This cafe still has branches. Remove or reassign them before deleting the cafe.');
  }

  cafe.status = 'deleted';
  await cafe.save();
  await User.updateMany({ cafes: cafe._id }, { $pull: { cafes: cafe._id } });

  await logActivity(req.user, 'CAFE_DELETE', `Deleted cafe: ${cafe.name}`, req, { cafeId: cafe._id });

  res.json({ success: true, message: 'Cafe deleted' });
});

module.exports = {
  getCafes,
  getCafe,
  createCafe,
  updateCafe,
  addCafeAdmin,
  removeCafeAdmin,
  deleteCafe,
  canAccessCafe,
  resolveUserCafeIds,
  CAFE_ADMIN_PERMISSIONS,
};
