const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');
const asyncHandler = require('../utils/asyncHandler');

// Helper to get days in a month (format: YYYY-MM)
const getDaysInMonth = (monthString) => {
  const [year, month] = monthString.split('-');
  return new Date(year, month, 0).getDate();
};

// Internal helper for aggregation pipeline
const getSalaryAggregation = async (matchQuery, daysInMonth) => {
  return await Attendance.aggregate([
    { $match: matchQuery },
    { $group: {
        _id: '$user',
        totalPresent: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        totalAbsent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        totalHalfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
      }
    },
    { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    { $lookup: {
        from: 'locations',
        localField: 'user.assignedLocation',
        foreignField: '_id',
        as: 'location'
      }
    },
    { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
    { $project: {
        _id: 1,
        name: '$user.name',
        email: '$user.email',
        role: '$user.role',
        locationName: '$location.name',
        monthlySalary: '$user.monthlySalary',
        totalPresent: 1,
        totalAbsent: 1,
        totalHalfDay: 1,
        payableDays: { $add: ['$totalPresent', { $multiply: ['$totalHalfDay', 0.5] }] },
        perDaySalary: { $divide: ['$user.monthlySalary', daysInMonth] },
        calculatedSalary: { 
          $multiply: [
            { $divide: ['$user.monthlySalary', daysInMonth] }, 
            { $add: ['$totalPresent', { $multiply: ['$totalHalfDay', 0.5] }] }
          ]
        }
      }
    }
  ]);
};

// @desc    Get salary of staff in a location
// @route   GET /api/salary/location
// @access  Private (Location Admin, Admin, Super Admin)
const getLocationSalary = asyncHandler(async (req, res) => {
  const { month, locationId } = req.query; // YYYY-MM
  if (!month) {
    res.status(400);
    throw new Error('Month parameter (YYYY-MM) is required');
  }

  const targetLocationId = req.user.role === 'location_admin' ? req.user.assignedLocation : locationId;
  if (!targetLocationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  const daysInMonth = getDaysInMonth(month);
  const matchQuery = { locationId: targetLocationId, date: { $regex: `^${month}` } };
  
  const salaries = await getSalaryAggregation(matchQuery, daysInMonth);

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
  const { month } = req.query; // YYYY-MM
  if (!month) {
    res.status(400);
    throw new Error('Month parameter (YYYY-MM) is required');
  }

  const daysInMonth = getDaysInMonth(month);
  const matchQuery = { date: { $regex: `^${month}` } };
  
  const salaries = await getSalaryAggregation(matchQuery, daysInMonth);

  // Group by location for expense overview
  const locationTotals = salaries.reduce((acc, curr) => {
    const locName = curr.locationName || 'Unassigned';
    if (!acc[locName]) acc[locName] = 0;
    acc[locName] += curr.calculatedSalary || 0;
    return acc;
  }, {});

  const totalPayrollCost = salaries.reduce((acc, curr) => acc + (curr.calculatedSalary || 0), 0);

  res.json({
    success: true,
    month,
    daysInMonth,
    totalPayrollCost,
    locationTotals,
    count: salaries.length,
    data: salaries,
  });
});

// @desc    Get specific user's salary
// @route   GET /api/salary/user/:id
// @access  Private (Location Admin, Admin, Super Admin)
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

  // Location admin can only check their own location staff
  if (req.user.role === 'location_admin' && user.assignedLocation?.toString() !== req.user.assignedLocation?.toString()) {
    res.status(403);
    throw new Error('Not authorized to view this user');
  }

  const daysInMonth = getDaysInMonth(month);
  const matchQuery = { user: user._id, date: { $regex: `^${month}` } };
  
  const salaryData = await getSalaryAggregation(matchQuery, daysInMonth);

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

module.exports = {
  getLocationSalary,
  getAllSalary,
  getUserSalary,
};
