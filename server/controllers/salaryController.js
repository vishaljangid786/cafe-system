const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');
const Payroll = require('../models/Payroll');
const asyncHandler = require('../utils/asyncHandler');
const { scopedLocationId, enforceLocationAccess, clampLimit } = require('../utils/accessControl');
const mongoose = require('mongoose');

// Helper to get days in a month (format: YYYY-MM)
const getDaysInMonth = (monthString) => {
  const [year, month] = monthString.split('-');
  return new Date(year, month, 0).getDate();
};

// Internal helper for aggregation pipeline
const getSalaryAggregation = async (userIds, month, daysInMonth) => {
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
                  { $regexMatch: { input: '$date', regex: `^${month}` } }
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
        payableDays: { $add: ['$totalPresent', { $multiply: ['$totalHalfDay', 0.5] }] },
        calculatedSalary: { 
          $multiply: [
            { $divide: [{ $ifNull: ['$monthlySalary', 0] }, daysInMonth] }, 
            { $add: ['$totalPresent', { $multiply: ['$totalHalfDay', 0.5] }] }
          ]
        }
      }
    }
  ]);
};

// @desc    Get salary of staff in a location
// @route   GET /api/salary/location
// @access  Private (Branch Admin, Admin, Super Admin)
const getLocationSalary = asyncHandler(async (req, res) => {
  const { month, locationId } = req.query; // YYYY-MM
  if (!month) {
    res.status(400);
    throw new Error('Month parameter (YYYY-MM) is required');
  }

  const targetLocationId = scopedLocationId(req, locationId);
  if (!targetLocationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  const daysInMonth = getDaysInMonth(month);
  const users = await User.find({ assignedLocation: targetLocationId }).select('_id');
  const userIds = users.map(u => u._id);
  
  const salaries = await getSalaryAggregation(userIds, month, daysInMonth);

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
  const { month, search, role, locationId, page = 1, limit = 10 } = req.query; // YYYY-MM
  if (!month) {
    res.status(400);
    throw new Error('Month parameter (YYYY-MM) is required');
  }

  // 1. Build User Filter Query for Search/Role/Location
  let userQuery = {};
  
  // Hierarchy Visibility Logic
  // Hierarchy Visibility Logic
  if (req.user.role === 'admin') {
    userQuery.role = { $in: ['branch_admin', 'staff'] };
  } else if (req.user.role === 'super_admin') {
    userQuery.role = { $in: ['admin', 'branch_admin', 'staff'] };
  }

  if (role) userQuery.role = role;

  const branchScope = scopedLocationId(req, locationId);
  if (branchScope) userQuery.assignedLocation = branchScope;
  
  if (search) {
    userQuery.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(userQuery).select('_id');
  const userIds = users.map(u => u._id);

  const daysInMonth = getDaysInMonth(month);
  
  // Get all matching salaries for totals (before pagination)
  const allSalaries = await getSalaryAggregation(userIds, month, daysInMonth);

  // Pagination logic
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const paginatedSalaries = allSalaries.slice(skip, skip + parseInt(limit));

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
      pages: Math.ceil(allSalaries.length / limit),
      limit: parseInt(limit)
    },
    data: paginatedSalaries,
  });
});

// @desc    Get specific user's salary
// @route   GET /api/salary/user/:id
// @access  Private (Branch Admin, Admin, Super Admin)
const getUserSalary = asyncHandler(async (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (!month) {
    res.status(400);
    throw new Error('Month parameter (YYYY-MM) is required');
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // RBAC: Branch admin / Admin can only check their authorized location staff
  enforceLocationAccess(req, res, user.assignedLocation, 'You do not have permission to view this user salary');

  const daysInMonth = getDaysInMonth(month);
  
  const salaryData = await getSalaryAggregation([user._id], month, daysInMonth);

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
  const last6Months = [];
  const now = new Date();
  
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toISOString().slice(0, 7);
    last6Months.push(month);
  }

  const history = await Promise.all(last6Months.map(async month => {
    const daysInMonth = getDaysInMonth(month);
    const salaryData = await getSalaryAggregation([userId], month, daysInMonth);
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
  if (!month) {
    res.status(400);
    throw new Error('Month parameter (YYYY-MM) is required');
  }

  const userId = req.user._id;
  const daysInMonth = getDaysInMonth(month);
  const salaryData = await getSalaryAggregation([userId], month, daysInMonth);

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
  const { month, locationId } = req.body;
  if (!month) {
    res.status(400);
    throw new Error('Month (YYYY-MM) is required');
  }

  const targetLocation = scopedLocationId(req, locationId);
  if (!targetLocation) {
    res.status(400);
    throw new Error('Location context missing');
  }

  const users = await User.find({ assignedLocation: targetLocation, role: { $in: ['staff', 'chef'] } }).lean();
  const userIds = users.map(u => u._id);
  const daysInMonth = getDaysInMonth(month);

  const rawSalaries = await getSalaryAggregation(userIds, month, daysInMonth);
  const processedPayrolls = [];

  for (const raw of rawSalaries) {
    const dailyRate = Math.round(raw.monthlySalary / daysInMonth) || 300; 
    const payableDays = raw.payableDays || 0;
    const baseSalary = dailyRate * payableDays;

    // Deterministic Calculation Stage (Replaces enterprise-risk randomness)
    const latePenalties = 0; // Should be pulled from late-clock-in logs in future Phase
    const absentPenalties = (raw.totalAbsent || 0) * dailyRate;

    const topSellerBonus = 0; // Should be pulled from sales volume in future Phase
    const performanceBonus = 0;

    const netSalary = Math.max(0, baseSalary + topSellerBonus + performanceBonus - latePenalties - absentPenalties);

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
        bonuses: { topSeller: topSellerBonus, performance: performanceBonus, extraShifts: 0 },
        netSalary,
        status: 'PENDING_BRANCH_APPROVAL'
      },
      { upsert: true, new: true }
    );
    processedPayrolls.push(payroll);
  }

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
  } else if (role === 'super_admin') {
    payroll.status = 'PAID';
    payroll.approvedBySuperAdminAt = new Date();
  } else {
    res.status(403);
    throw new Error('Approval workflow level not allowed or out of sequence');
  }

  await payroll.save();
  res.json({ success: true, data: payroll });
});

const getPayrollHistory = asyncHandler(async (req, res) => {
  const { month, locationId } = req.query;
  const filter = {};
  if (month) filter.month = month;

  const branchScope = scopedLocationId(req, locationId);
  if (branchScope) {
    const users = await User.find({ assignedLocation: branchScope }).select('_id');
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
