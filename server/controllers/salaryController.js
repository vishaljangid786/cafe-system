const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');
const Payroll = require('../models/Payroll');
const Expense = require('../models/Expense');
const Notification = require('../models/Notification');
const TransactionService = require('../services/transactionService');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { scopedLocationId, scopedLocationIds, isAllLocation, enforceLocationAccess, clampLimit, escapeRegex } = require('../utils/accessControl');
const { requireRecord, assertCanDelete, announceDeletion } = require('../utils/deleteGuard');
const { getSettings, num } = require('../utils/settings');
const mongoose = require('mongoose');

// Validate a month string is exactly YYYY-MM with a real month (01-12).
const isValidMonth = (monthString) =>
  typeof monthString === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthString);

// Helper to get days in a month (format: YYYY-MM). Caller must validate format
// first (an out-of-range month would otherwise roll over and miscount days).
const getDaysInMonth = (monthString) => {
  const [year, month] = monthString.split('-');
  return new Date(year, month, 0).getDate();
};

// Standard guard for endpoints that take a ?month=YYYY-MM param.
const requireValidMonth = (res, month) => {
  if (!month) {
    res.status(400);
    throw new Error('Month parameter (YYYY-MM) is required');
  }
  if (!isValidMonth(month)) {
    res.status(400);
    throw new Error('Month must be in YYYY-MM format');
  }
};

// Roles whose salaries a given actor may view — never peers or superiors.
// A branch_admin therefore sees only staff/chef (not themselves, not admins),
// matching the hierarchy visibility enforced by GET /api/users.
const salaryVisibleRoles = (actorRole) =>
  actorRole === 'super_admin'
    ? ['admin', 'branch_admin', 'location_admin', 'staff', 'chef']
    : actorRole === 'admin'
      ? ['branch_admin', 'location_admin', 'staff', 'chef']
      : ['staff', 'chef'];

// Sum manual adjustment line-items of a given kind ('bonus' | 'deduction').
const sumAdjustments = (adjustments, kind) =>
  (adjustments || [])
    .filter((a) => a.type === kind)
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

// Single source of truth for netSalary: base + all bonuses + manual bonuses,
// minus all penalties and manual deductions, floored at 0. Used by the adjust
// endpoint so a salary stays consistent after every change.
const recomputeNetSalary = (p) => {
  const bonuses = (p.bonuses?.topSeller || 0) + (p.bonuses?.performance || 0) + (p.bonuses?.extraShifts || 0);
  const penalties = (p.penalties?.lateMark || 0) + (p.penalties?.absent || 0) + (p.penalties?.leave || 0);
  const adjBonus = sumAdjustments(p.adjustments, 'bonus');
  const adjDeduction = sumAdjustments(p.adjustments, 'deduction');
  return Math.max(0, (p.baseSalary || 0) + bonuses + adjBonus - penalties - adjDeduction);
};

// A payroll is still editable/approvable until it is PAID or REJECTED.
const isPendingStatus = (status) => status !== 'PAID' && status !== 'REJECTED';

// Internal helper for aggregation pipeline
const getSalaryAggregation = async (userIds, month, daysInMonth, stdDayMin = 480) => {
  return await User.aggregate([
    { $match: { _id: { $in: userIds } } },
    { $lookup: {
        from: 'attendances',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { 
              $expr: { 
                $and: [
                  { $eq: ['$user', '$$userId'] },
                  { $regexMatch: { input: '$date', regex: `^${escapeRegex(month)}` } }
                ]
              }
            }
          }
        ],
        as: 'attendance'
      }
    },
    { $lookup: {
        from: 'locations',
        localField: 'assignedLocation',
        foreignField: '_id',
        as: 'location'
      }
    },
    { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
    { $addFields: {
        totalPresent: { $size: { $filter: { input: '$attendance', as: 'a', cond: { $eq: ['$$a.status', 'present'] } } } },
        totalAbsent: { $size: { $filter: { input: '$attendance', as: 'a', cond: { $eq: ['$$a.status', 'absent'] } } } },
        totalHalfDay: { $size: { $filter: { input: '$attendance', as: 'a', cond: { $eq: ['$$a.status', 'half-day'] } } } },
        // Paid non-working days + late count.
        totalWeekOff: { $size: { $filter: { input: '$attendance', as: 'a', cond: { $eq: ['$$a.status', 'week-off'] } } } },
        totalLeave: { $size: { $filter: { input: '$attendance', as: 'a', cond: { $eq: ['$$a.status', 'leave'] } } } },
        totalLate: { $size: { $filter: { input: '$attendance', as: 'a', cond: { $eq: ['$$a.isLate', true] } } } },
        // Overtime = minutes worked beyond a standard 8h (480 min) day, summed.
        totalOvertimeMinutes: {
          $sum: {
            $map: {
              input: '$attendance',
              as: 'a',
              in: { $max: [0, { $subtract: [{ $ifNull: ['$$a.workedMinutes', 0] }, stdDayMin] }] },
            },
          },
        },
      }
    },
    { $addFields: {
        // Paid days = worked (present + half) + paid non-working (week-off + leave).
        payableDays: {
          $add: [
            '$totalPresent',
            { $multiply: ['$totalHalfDay', 0.5] },
            '$totalWeekOff',
            '$totalLeave',
          ],
        },
      }
    },
    { $project: {
        _id: 1,
        name: 1,
        email: 1,
        role: 1,
        profileImageUrl: 1,
        locationName: '$location.name',
        monthlySalary: 1,
        totalPresent: 1,
        totalAbsent: 1,
        totalHalfDay: 1,
        totalWeekOff: 1,
        totalLeave: 1,
        totalLate: 1,
        totalOvertimeMinutes: 1,
        payableDays: 1,
        calculatedSalary: {
          $multiply: [
            { $divide: [{ $ifNull: ['$monthlySalary', 0] }, daysInMonth] },
            '$payableDays',
          ]
        }
      }
    }
  ]);
};

// Resolve a branch's configured standard-day length (for overtime display); a
// multi-branch/$in scope falls back to global so display matches generation.
const stdMinFor = async (branchId) => {
  const loc = branchId && typeof branchId !== 'object' ? branchId : null;
  return num((await getSettings(loc)).payroll.standardDayMinutes, 480) || 480;
};

// Resolve the assignedLocation filter for the salary endpoints from the optional
// branch (locationId) AND the optional cafe (cafeId — set by the global top-navbar
// cafe selector). Returns null for "everything in scope" (no filter) or a
// { $in: [branchIds] }. When a cafe is chosen we intersect the branch scope with
// that cafe's branches, so "All Branches" under a cafe means that cafe's branches
// only — never every branch in the system.
const resolveAssignedLocationFilter = async (req, locationId, cafeId) => {
  let scope = scopedLocationIds(req, locationId); // null (all in scope) | { $in: [...] }
  if (cafeId && !isAllLocation(cafeId)) {
    const branches = await Location.find({ cafe: cafeId, isPermanentlyDeleted: { $ne: true } })
      .select('_id').lean();
    const cafeBranchIds = branches.map((b) => b._id.toString());
    scope = scope == null
      ? { $in: cafeBranchIds }
      : { $in: (scope.$in || []).map(String).filter((id) => cafeBranchIds.includes(id)) };
  }
  return scope;
};

// @desc    Get salary of staff in a location
// @route   GET /api/salary/location
// @access  Private (Branch Admin, Admin, Super Admin)
const getLocationSalary = asyncHandler(async (req, res) => {
  const { month, locationId } = req.query; // YYYY-MM
  requireValidMonth(res, month);

  const targetLocationId = scopedLocationId(req, locationId);
  if (!targetLocationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  const daysInMonth = getDaysInMonth(month);
  // Only list users this actor is allowed to see (branch_admin → staff/chef only,
  // i.e. never themselves or admins).
  const users = await User.find({
    assignedLocation: targetLocationId,
    role: { $in: salaryVisibleRoles(req.user.role) },
    deletedAt: null,
  }).select('_id');
  const userIds = users.map(u => u._id);
  
  const salaries = await getSalaryAggregation(userIds, month, daysInMonth, await stdMinFor(targetLocationId));

  res.json({
    success: true,
    month,
    daysInMonth,
    count: salaries.length,
    data: salaries,
  });
});

// @desc    Get salary of all staff across all locations
// @route   GET /api/salary/all
// @access  Private (Admin, Super Admin)
const getAllSalary = asyncHandler(async (req, res) => {
  const { month, search, role, locationId, cafeId, page = 1, limit = 10 } = req.query; // YYYY-MM
  requireValidMonth(res, month);

  // 1. Build User Filter Query for Search/Role/Location
  let userQuery = {};

  // Hierarchy visibility: which roles this actor may see salaries for (never peers
  // or superiors). A requested ?role filter is intersected with this — otherwise an
  // admin could pass ?role=admin to view peer admins' salaries.
  const visibleRoles = salaryVisibleRoles(req.user.role);
  userQuery.role = (role && visibleRoles.includes(role)) ? role : { $in: visibleRoles };

  // Scope by branch and/or the globally-selected cafe (top-navbar cafe filter).
  const branchScope = await resolveAssignedLocationFilter(req, locationId, cafeId);
  if (branchScope) userQuery.assignedLocation = branchScope;
  
  if (search) {
    const safeSearch = escapeRegex(search);
    userQuery.$or = [
      { name: { $regex: safeSearch, $options: 'i' } },
      { email: { $regex: safeSearch, $options: 'i' } }
    ];
  }

  const users = await User.find(userQuery).select('_id');
  const userIds = users.map(u => u._id);

  const daysInMonth = getDaysInMonth(month);
  
  // Get all matching salaries for totals (before pagination)
  const allSalaries = await getSalaryAggregation(userIds, month, daysInMonth);

  // Pagination logic
  const lim = clampLimit(limit, 20);
  const skip = (parseInt(page) - 1) * lim;
  const paginatedSalaries = allSalaries.slice(skip, skip + lim);

  // Group by location for expense overview
  const locationTotals = allSalaries.reduce((acc, curr) => {
    const locName = curr.locationName || 'Unassigned';
    if (!acc[locName]) acc[locName] = 0;
    acc[locName] += curr.calculatedSalary || 0;
    return acc;
  }, {});

  const totalPayrollCost = allSalaries.reduce((acc, curr) => acc + (curr.calculatedSalary || 0), 0);

  res.json({
    success: true,
    month,
    daysInMonth,
    totalPayrollCost,
    locationTotals,
    pagination: {
      total: allSalaries.length,
      page: parseInt(page),
      pages: Math.ceil(allSalaries.length / lim),
      limit: lim
    },
    data: paginatedSalaries,
  });
});

// @desc    Get specific user's salary
// @route   GET /api/salary/user/:id
// @access  Private (Branch Admin, Admin, Super Admin)
const getUserSalary = asyncHandler(async (req, res) => {
  const { month } = req.query; // YYYY-MM
  requireValidMonth(res, month);

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // RBAC: respect the same salary role hierarchy as the list endpoints — a
  // non-super actor can never view a peer's or superior's salary (e.g. an admin
  // viewing another admin, or a branch_admin viewing themselves/an admin).
  if (req.user.role !== 'super_admin' && !salaryVisibleRoles(req.user.role).includes(user.role)) {
    res.status(403);
    throw new Error('You do not have permission to view this user salary');
  }

  // RBAC: Branch admin / Admin can only check their authorized location staff
  enforceLocationAccess(req, res, user.assignedLocation, 'You do not have permission to view this user salary');

  const daysInMonth = getDaysInMonth(month);

  const salaryData = await getSalaryAggregation([user._id], month, daysInMonth, await stdMinFor(user.assignedLocation));

  res.json({
    success: true,
    month,
    daysInMonth,
    data: salaryData.length > 0 ? salaryData[0] : {
      name: user.name,
      monthlySalary: user.monthlySalary,
      totalPresent: 0,
      totalAbsent: 0,
      totalHalfDay: 0,
      payableDays: 0,
      calculatedSalary: 0
    },
  });
});

const getMySalaryHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const myStdMin = await stdMinFor(req.user.assignedLocation);
  const last6Months = [];
  const now = new Date();
  
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    // Build YYYY-MM from LOCAL components. toISOString() converts local midnight
    // to UTC, which in any timezone ahead of UTC (e.g. IST +05:30) lands on the
    // previous day — shifting every label back a whole month.
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    last6Months.push(month);
  }

  const history = await Promise.all(last6Months.map(async month => {
    const daysInMonth = getDaysInMonth(month);
    const salaryData = await getSalaryAggregation([userId], month, daysInMonth, myStdMin);
    return {
      month,
      ...(salaryData.length > 0 ? salaryData[0] : { 
        calculatedSalary: 0, 
        totalPresent: 0, 
        totalAbsent: 0,
        totalHalfDay: 0,
        payableDays: 0
      })
    };
  }));

  res.json({ success: true, data: history });
});

const getMySalary = asyncHandler(async (req, res) => {
  const { month } = req.query; // YYYY-MM
  requireValidMonth(res, month);

  const userId = req.user._id;
  const daysInMonth = getDaysInMonth(month);
  const salaryData = await getSalaryAggregation([userId], month, daysInMonth, await stdMinFor(req.user.assignedLocation));

  res.json({
    success: true,
    month,
    daysInMonth,
    data: salaryData.length > 0 ? salaryData[0] : {
      name: req.user.name,
      monthlySalary: req.user.monthlySalary,
      totalPresent: 0,
      totalAbsent: 0,
      totalHalfDay: 0,
      payableDays: 0,
      calculatedSalary: 0
    }
  });
});

// Core payroll builder shared by the HTTP handler and the month-end cron. Given a
// month and an optional branch scope (null = every branch), it (re)generates a
// PENDING_APPROVAL payroll for each staff/chef, skipping any record already past
// pending. No req/res — returns the processed payroll docs.
const buildPayrollsForMonth = async (month, branchScope = null) => {
  const userQuery = { role: { $in: ['staff', 'chef'] }, deletedAt: null };
  if (branchScope) userQuery.assignedLocation = branchScope;

  const users = await User.find(userQuery).lean();
  const daysInMonth = getDaysInMonth(month);

  // Resolve payroll config PER BRANCH (a multi-branch run must not collapse every
  // branch to the global config), and run the overtime aggregation per branch so
  // overtime-minutes use each branch's own standard-day length. (review #15)
  const usersByBranch = new Map();
  for (const u of users) {
    const key = (u.assignedLocation || 'global').toString();
    if (!usersByBranch.has(key)) usersByBranch.set(key, { branchId: u.assignedLocation || null, ids: [] });
    usersByBranch.get(key).ids.push(u._id);
  }

  const rawSalaries = [];
  for (const { branchId, ids } of usersByBranch.values()) {
    const payCfg = (await getSettings(branchId)).payroll;
    const stdDayMin = num(payCfg.standardDayMinutes, 480) || 480; // guard div-by-zero
    const raws = await getSalaryAggregation(ids, month, daysInMonth, stdDayMin);
    raws.forEach((r) => rawSalaries.push({ ...r, _payCfg: payCfg, _stdDayMin: stdDayMin, _branchId: branchId }));
  }

  const processedPayrolls = [];

  for (const raw of rawSalaries) {
    const payCfg = raw._payCfg;
    // Preserve a legitimate 0 (e.g. penalties disabled); `Number(x) || d` wrongly
    // discards 0. latePenaltyGroup/overtimeMultiplier have schema min 1. (review #4/#10)
    const LATE_GROUP = num(payCfg.latePenaltyGroup, 3) || 3;
    const LATE_DAY_UNIT = num(payCfg.latePenaltyDayUnit, 0.5);
    const OT_MULTIPLIER = num(payCfg.overtimeMultiplier, 1.5) || 1.5;
    const STD_DAY_MIN = raw._stdDayMin;

    // No phantom wage: a staff/chef with an unset (0) monthlySalary gets 0, not a
    // silent ₹300/day default that would fabricate payroll.
    const dailyRate = Math.round((raw.monthlySalary || 0) / daysInMonth) || 0;
    const payableDays = raw.payableDays || 0;
    const baseSalary = dailyRate * payableDays;

    // Late penalty from real clock-in data (Attendance.isLate -> raw.totalLate).
    // Policy is configurable per branch (Settings.payroll): every LATE_GROUP late
    // marks deducts LATE_DAY_UNIT days of pay.
    const lateCount = raw.totalLate || 0;
    const latePenalties = Math.round(dailyRate * Math.floor(lateCount / LATE_GROUP) * LATE_DAY_UNIT);
    // Absent days are ALREADY excluded from payableDays (so baseSalary doesn't pay
    // for them). Subtracting them again was a double penalty — keep this at 0.
    const absentPenalties = 0;

    // Overtime pay from clock-in/out data: minutes beyond the standard day, paid
    // at the configured multiplier of the hourly rate (dailyRate / standard hours).
    const standardHours = (STD_DAY_MIN / 60) || 8;
    const hourlyRate = dailyRate / standardHours;
    const overtimePay = Math.round((Number(raw.totalOvertimeMinutes || 0) / 60) * hourlyRate * OT_MULTIPLIER);

    const topSellerBonus = 0; // Sales-volume bonus — needs a defined policy + sales link
    const performanceBonus = 0;

    const netSalary = Math.max(0, baseSalary + topSellerBonus + performanceBonus + overtimePay - latePenalties - absentPenalties);

    // Don't clobber a payroll that's already moving through approval (or paid):
    // only a still-pending or rejected record may be (re)generated. Manual
    // adjustments are reset on regeneration since base figures changed.
    const existingPayroll = await Payroll.findOne({ user: raw._id, month });
    if (existingPayroll && !['PENDING_APPROVAL', 'PENDING_BRANCH_APPROVAL', 'REJECTED'].includes(existingPayroll.status)) {
      processedPayrolls.push(existingPayroll);
      continue;
    }

    const payroll = await Payroll.findOneAndUpdate(
      { user: raw._id, month },
      {
        dailyRate,
        payableDays,
        baseSalary,
        // Capture the branch this payroll belongs to AT GENERATION time, so a later
        // transfer doesn't re-attribute the salary expense to the employee's new
        // branch on approval.
        locationId: raw._branchId || undefined,
        penalties: { lateMark: latePenalties, absent: absentPenalties, leave: 0 },
        bonuses: { topSeller: topSellerBonus, performance: performanceBonus, extraShifts: overtimePay },
        adjustments: [],
        netSalary,
        rejectedReason: null,
        status: 'PENDING_APPROVAL'
      },
      { upsert: true, new: true }
    );
    processedPayrolls.push(payroll);
  }

  return processedPayrolls;
};

const generatePayroll = asyncHandler(async (req, res) => {
  const { month, locationId, cafeId } = req.body;
  if (!month) {
    res.status(400);
    throw new Error('Month (YYYY-MM) is required');
  }
  if (!isValidMonth(month)) {
    res.status(400);
    throw new Error('Month must be in YYYY-MM format');
  }

  // Resolve the branch scope, honouring both the branch toggle and the global
  // cafe filter. null = every branch in scope (e.g. super_admin + All Branches +
  // All Cafes); { $in: [...] } = a specific branch, the caller's branches, or the
  // selected cafe's branches. The previous singular scopedLocationId returned null
  // for super_admin + "all" and 400'd here, which broke "Calculate Monthly Salary"
  // whenever All Branches was selected.
  const branchScope = await resolveAssignedLocationFilter(req, locationId, cafeId);

  const processedPayrolls = await buildPayrollsForMonth(month, branchScope);

  await sendNotification({
    title: 'Payroll generated',
    message: `Payroll for ${month} was generated by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
  });

  res.json({ success: true, count: processedPayrolls.length, data: processedPayrolls });
});

// Month-end automatic generation: build PENDING_APPROVAL payrolls for every staff
// /chef across all branches, then notify admins/branch-admins so they can review,
// adjust and approve. Idempotent — re-running only (re)generates still-pending
// records (see buildPayrollsForMonth). Returns a count for the caller/cron logs.
const runMonthlyPayrollGeneration = async (month) => {
  if (!isValidMonth(month)) {
    throw new Error('runMonthlyPayrollGeneration: month must be YYYY-MM');
  }
  const processed = await buildPayrollsForMonth(month, null);

  // Best-effort: tell every admin / branch-admin / super-admin the payroll is
  // waiting. Created directly (no human actor) — sender is any super_admin.
  try {
    const [systemSender, recipients] = await Promise.all([
      User.findOne({ role: 'super_admin' }).select('_id'),
      User.find({ role: { $in: ['admin', 'branch_admin', 'super_admin'] }, deletedAt: null }).select('_id'),
    ]);
    if (systemSender && recipients.length) {
      await Notification.create({
        title: 'Monthly payroll ready for approval',
        message: `Payroll for ${month} was generated automatically — review, adjust and approve it.`,
        type: 'activity',
        sender: systemSender._id,
        roleTarget: 'admin',
        recipients: recipients.map((u) => ({ user: u._id, isRead: false })),
      });
    }
  } catch (err) {
    console.error('[PAYROLL CRON] notification failed:', err);
  }

  return processed.length;
};

// Apply a manual deduction or bonus to a still-pending payroll. Gated by
// salaries.modify (admin by default; a branch_admin only if explicitly granted).
// Recomputes netSalary so the figure stays correct, and refuses once the salary
// has been PAID (already on the books) or REJECTED.
const adjustPayroll = asyncHandler(async (req, res) => {
  const { type, amount, reason } = req.body;

  if (!['deduction', 'bonus'].includes(type)) {
    res.status(400);
    throw new Error("Adjustment type must be 'deduction' or 'bonus'");
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    res.status(400);
    throw new Error('Adjustment amount must be a positive number');
  }
  if (!reason || !String(reason).trim()) {
    res.status(400);
    throw new Error('A reason is required for every salary adjustment');
  }

  const payroll = await Payroll.findById(req.params.id).populate('user', 'name role assignedLocation');
  if (!payroll) {
    res.status(404);
    throw new Error('Payroll record not found');
  }

  enforceLocationAccess(req, res, payroll.user?.assignedLocation, 'You do not have permission to adjust this payroll');

  if (!isPendingStatus(payroll.status)) {
    res.status(400);
    throw new Error(`Cannot adjust a payroll that is already ${payroll.status === 'PAID' ? 'paid' : 'rejected'}`);
  }

  payroll.adjustments.push({
    type,
    amount: amt,
    reason: String(reason).trim(),
    by: req.user._id,
    byName: req.user.name,
    at: new Date(),
  });
  payroll.netSalary = recomputeNetSalary(payroll);
  await payroll.save();

  await sendNotification({
    title: type === 'deduction' ? 'Salary deduction applied' : 'Salary bonus applied',
    message: `${req.user.name} applied a ${type} of ₹${amt} to ${payroll.user?.name}'s ${payroll.month} payroll (${String(reason).trim()}).`,
    type: 'activity',
    performedByUser: req.user,
    locationId: payroll.user?.assignedLocation,
    notifyUserId: payroll.user?._id,
  });

  res.json({ success: true, data: payroll });
});

const approvePayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id).populate('user', 'name role assignedLocation');
  if (!payroll) {
    res.status(404);
    throw new Error('Payroll record not found');
  }

  // Attribute to the branch the payroll was generated for; fall back to the employee's
  // current branch for legacy records that predate payroll.locationId.
  const payrollBranch = payroll.locationId || payroll.user?.assignedLocation;
  enforceLocationAccess(req, res, payrollBranch, 'You do not have permission to approve this payroll');

  const { reject, reason } = req.body || {};

  if (payroll.status === 'PAID') {
    res.status(400);
    throw new Error('This payroll has already been paid');
  }

  // Reject path — bounce a pending payroll back so it can be regenerated.
  if (reject) {
    if (payroll.status === 'REJECTED') {
      res.status(400);
      throw new Error('This payroll is already rejected');
    }
    payroll.status = 'REJECTED';
    payroll.rejectedReason = reason ? String(reason).trim() : undefined;
    await payroll.save();
    await sendNotification({
      title: 'Payroll rejected',
      message: `Payroll for ${payroll.user?.name} (${payroll.month}) was rejected by ${req.user.name}.`,
      type: 'activity',
      performedByUser: req.user,
      locationId: payroll.user?.assignedLocation,
      notifyUserId: payroll.user?._id,
    });
    return res.json({ success: true, data: payroll });
  }

  if (payroll.status === 'REJECTED') {
    res.status(400);
    throw new Error('Regenerate this payroll before approving it');
  }

  // Single-stage final approval: anyone holding salaries.approve (the route gate
  // already enforced it) marks the payroll PAID and posts the salary to the
  // ledger as a real Expense. netSalary is recomputed first so any last-minute
  // adjustment is captured. ledgerExpenseId guards against double-posting.
  payroll.netSalary = recomputeNetSalary(payroll);
  payroll.status = 'PAID';
  payroll.approvedBy = req.user._id;
  payroll.approvedAt = new Date();

  // Book the salary against the branch the payroll was GENERATED for (payrollBranch),
  // not the employee's current branch — otherwise transferring an employee after
  // generation retroactively charges the cost to their new branch's P&L.
  if (!payroll.ledgerExpenseId && payrollBranch) {
    const [year, mon] = String(payroll.month).split('-');
    const expenseDate = (year && mon) ? new Date(Number(year), Number(mon) - 1, 28) : new Date();
    const expense = await Expense.create({
      title: `Salary — ${payroll.user.name} (${payroll.month})`,
      description: `Payroll for ${payroll.user.name} (${payroll.user.role}) — ${payroll.payableDays} payable days`,
      amount: Number(payroll.netSalary) || 0,
      type: 'EXPENSE',
      category: 'Salary',
      status: 'approved',
      date: expenseDate,
      locationId: payrollBranch,
      createdBy: req.user._id,
      proofImage: 'payroll-auto',
    });
    await TransactionService.syncExpenseToTransaction(expense);
    payroll.ledgerExpenseId = expense._id;
  }

  await payroll.save();

  await sendNotification({
    title: 'Payroll approved & paid',
    message: `Payroll for ${payroll.user?.name} (${payroll.month}) was approved by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: payroll.user?.assignedLocation,
    notifyUserId: payroll.user?._id,
  });

  res.json({ success: true, data: payroll });
});

// A PAID payroll is the proof that money left the cafe and reached the employee;
// FINAL_APPROVED is the legacy "signed-off, awaiting disbursal" figure. Both are
// settled statements rather than drafts, so neither may be removed casually.
const SETTLED_PAYROLL_STATUSES = ['PAID', 'FINAL_APPROVED'];

// @desc    Delete a payroll record
// @route   DELETE /api/salary/:id  (alias: DELETE /api/salary/payroll/:id)
// @access  Private (salaries.delete)
const deletePayroll = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400);
    throw new Error('That payroll id is not valid. Refresh the payroll list and try again.');
  }

  const payroll = await Payroll.findById(req.params.id).populate('user', 'name role assignedLocation');
  requireRecord(res, payroll, 'Payroll record');

  const staffId = payroll.user?._id || payroll.user;
  const staffName = payroll.user?.name || 'this employee';

  // Same branch attribution the approve path uses: the branch captured at generation
  // wins, falling back to the employee's current branch for legacy rows that predate
  // Payroll.locationId. If neither resolves (employee deleted / never assigned) the
  // record is effectively global and only admin/super_admin may remove it.
  const payrollBranch = payroll.locationId || payroll.user?.assignedLocation;

  // NOTE: no `ownerId`. The employee the payroll belongs to is precisely the person
  // with a motive to erase an unfavourable figure, so deleting always requires
  // salaries.delete plus reach over the payroll's branch.
  assertCanDelete(req, res, {
    resource: 'payroll record',
    actionKey: 'salaries.delete',
    locationId: payrollBranch,
    globalRoles: ['super_admin', 'admin'],
  });

  // Money/proof guard. A PAID row cannot be rejected either (approvePayroll refuses
  // once status is PAID), so the honest alternative is a correcting adjustment on the
  // next month — not a silent erase. Only a super_admin may force it, and only they
  // can be trusted to also reconcile the ledger.
  if (SETTLED_PAYROLL_STATUSES.includes(payroll.status) && req.user.role !== 'super_admin') {
    res.status(400);
    throw new Error(
      payroll.status === 'PAID'
        ? `This payroll is already paid — it is the record that ${staffName} received ₹${payroll.netSalary} for ${payroll.month}, and that amount is posted to the branch ledger. A paid salary cannot be deleted; apply a correcting adjustment to the next month's payroll, or ask a super admin if it was posted in error.`
        : `This payroll for ${staffName} (${payroll.month}) is already approved and waiting to be paid. Reject it first (which reopens the month), then recalculate — only a super admin can delete an approved payroll outright.`
    );
  }

  // Cascade: a PAID payroll owns the salary Expense it posted to the ledger
  // (ledgerExpenseId) and that Expense owns a Transaction. We DELETE both rather
  // than leave them. Leaving them would be worse than an orphan: Payroll has a
  // unique (user, month) index, so removing the payroll lets the month be
  // regenerated and approved again — which creates a SECOND salary Expense and
  // double-charges the branch's P&L for one month of pay.
  let ledgerNote = '';
  if (payroll.ledgerExpenseId) {
    await Expense.deleteOne({ _id: payroll.ledgerExpenseId });
    await TransactionService.deleteExpenseTransaction(payroll.ledgerExpenseId);
    ledgerNote = `The matching salary expense of ₹${payroll.netSalary} was removed from the ${payroll.month} ledger as well.`;
  }

  await payroll.deleteOne();

  await announceDeletion(req, {
    resource: 'Payroll record',
    name: `${staffName} — ${payroll.month} (₹${payroll.netSalary})`,
    locationId: payrollBranch,
    action: 'PAYROLL_DELETE',
    type: 'user_action',
    // The employee is not a manager, so the manager fan-out would never reach them —
    // and this is their own pay record, so they must be told directly.
    notifyUserIds: staffId ? [staffId] : [],
    detail: ledgerNote,
    metadata: {
      userId: staffId ? String(staffId) : null,
      month: payroll.month,
      status: payroll.status,
      netSalary: payroll.netSalary,
      ledgerExpenseId: payroll.ledgerExpenseId ? String(payroll.ledgerExpenseId) : null,
    },
  });

  res.json({
    success: true,
    message: 'Payroll record removed',
  });
});

const getPayrollHistory = asyncHandler(async (req, res) => {
  const { month, locationId } = req.query;
  const filter = {};
  if (month) filter.month = month;

  const branchScope = scopedLocationId(req, locationId);
  if (branchScope) {
    const users = await User.find({
      assignedLocation: branchScope,
      role: { $in: salaryVisibleRoles(req.user.role) },
      deletedAt: null,
    }).select('_id');
    filter.user = { $in: users.map(u => u._id) };
  }

  const records = await Payroll.find(filter).populate('user', 'name role email').lean();
  res.json({ success: true, count: records.length, data: records });
});

module.exports = {
  getLocationSalary,
  getAllSalary,
  getUserSalary,
  getMySalaryHistory,
  getMySalary,
  generatePayroll,
  runMonthlyPayrollGeneration,
  adjustPayroll,
  approvePayroll,
  deletePayroll,
  getPayrollHistory
};
