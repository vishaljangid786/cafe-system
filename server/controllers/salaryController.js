const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');
const Payroll = require('../models/Payroll');
const Expense = require('../models/Expense');
const TransactionService = require('../services/transactionService');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { scopedLocationId, scopedLocationIds, isAllLocation, enforceLocationAccess, clampLimit, escapeRegex } = require('../utils/accessControl');
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
    const month = d.toISOString().slice(0, 7);
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

  const userQuery = { role: { $in: ['staff', 'chef'] } };
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
    raws.forEach((r) => rawSalaries.push({ ...r, _payCfg: payCfg, _stdDayMin: stdDayMin }));
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

    const existingPayroll = await Payroll.findOne({ user: raw._id, month });
    if (existingPayroll && !['PENDING_BRANCH_APPROVAL', 'REJECTED'].includes(existingPayroll.status)) {
      processedPayrolls.push(existingPayroll);
      continue;
    }

    const payroll = await Payroll.findOneAndUpdate(
      { user: raw._id, month },
      {
        dailyRate,
        payableDays,
        baseSalary,
        penalties: { lateMark: latePenalties, absent: absentPenalties, leave: 0 },
        bonuses: { topSeller: topSellerBonus, performance: performanceBonus, extraShifts: overtimePay },
        netSalary,
        status: 'PENDING_BRANCH_APPROVAL'
      },
      { upsert: true, new: true }
    );
    processedPayrolls.push(payroll);
  }

  await sendNotification({
    title: 'Payroll generated',
    message: `Payroll for ${month} was generated by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
  });

  res.json({ success: true, count: processedPayrolls.length, data: processedPayrolls });
});

const approvePayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id).populate('user', 'name role assignedLocation');
  if (!payroll) {
    res.status(404);
    throw new Error('Payroll record not found');
  }

  enforceLocationAccess(req, res, payroll.user?.assignedLocation, 'You do not have permission to approve this payroll');

  const role = req.user.role;

  if (role === 'branch_admin' && payroll.status === 'PENDING_BRANCH_APPROVAL') {
    payroll.status = 'PENDING_ADMIN_APPROVAL';
    payroll.approvedByBranchAt = new Date();
  } else if (role === 'admin' && payroll.status === 'PENDING_ADMIN_APPROVAL') {
    payroll.status = 'FINAL_APPROVED';
    payroll.approvedByAdminAt = new Date();
  } else if (role === 'super_admin' && payroll.status === 'FINAL_APPROVED') {
    // Only finalize an admin-approved payroll — don't skip stages, and (since PAID
    // no longer matches any branch) a paid payroll can't be re-run/re-paid.
    payroll.status = 'PAID';
    payroll.approvedBySuperAdminAt = new Date();

    // Post the salary cost to the ledger so it shows up as a real expense in
    // P&L (previously payroll never hit the books, overstating profit). Guard with
    // ledgerExpenseId so a salary is never double-posted.
    if (!payroll.ledgerExpenseId && payroll.user?.assignedLocation) {
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
        locationId: payroll.user.assignedLocation,
        createdBy: req.user._id,
        proofImage: 'payroll-auto',
      });
      await TransactionService.syncExpenseToTransaction(expense);
      payroll.ledgerExpenseId = expense._id;
    }
  } else {
    res.status(403);
    throw new Error('Approval workflow level not allowed or out of sequence');
  }

  await payroll.save();

  await sendNotification({
    title: 'Payroll approved',
    message: `Payroll for ${payroll.user?.name} (${payroll.month}) was approved by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: payroll.user?.assignedLocation,
    notifyUserId: payroll.user?._id,
  });

  res.json({ success: true, data: payroll });
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
  approvePayroll,
  getPayrollHistory
};
