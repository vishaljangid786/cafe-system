const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { enforceLocationAccess, clampLimit, escapeRegex } = require('../utils/accessControl');

// Helper to validate date format (YYYY-MM-DD)
const isValidDate = (dateString) => {
  const regEx = /^\d{4}-\d{2}-\d{2}$/;
  return dateString.match(regEx) != null;
};

// @desc    Mark daily attendance
// @route   POST /api/attendance/mark
// @access  Private (Branch Admin)
const markAttendance = asyncHandler(async (req, res) => {
  const { userId, date, status } = req.body;

  if (!isValidDate(date)) {
    res.status(400);
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  const today = new Date().toISOString().split('T')[0];

  if (date > today) {
    res.status(400);
    throw new Error('Cannot mark attendance for future dates');
  }

  // Branch Admins can only mark for today
  if (req.user.role === 'branch_admin' && date !== today) {
    res.status(403);
    throw new Error('Branch Admins can only mark or edit attendance for the current day. Contact Admin for past corrections.');
  }

  // Validate user
  const staff = await User.findById(userId);
  if (!staff) {
    res.status(404);
    throw new Error('User not found');
  }

  // Ensure branch admin is marking for their own location
  if (req.user.role === 'branch_admin' && staff.assignedLocation?.toString() !== req.user.assignedLocation?.toString()) {
    res.status(403);
    throw new Error('Not authorized to mark attendance for personnel of another location');
  }

  const targetLocationId = staff.assignedLocation;
  if (!targetLocationId) {
    res.status(400);
    throw new Error('Target personnel has no assigned location');
  }

  enforceLocationAccess(req, res, targetLocationId, 'Not authorized to mark attendance for this location');

  // Upsert attendance
  const attendance = await Attendance.findOneAndUpdate(
    { user: userId, date },
    {
      user: userId,
      locationId: targetLocationId,
      date,
      status,
      markedBy: req.user._id,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await sendNotification({
    title: 'Attendance Marked',
    message: `Attendance for ${staff.name} marked as ${status} for ${date}.`,
    type: 'user_action',
    performedByUser: req.user,
    locationId: targetLocationId,
  });

  res.json({
    success: true,
    data: attendance,
  });
});

// @desc    Get attendance for a specific location
// @route   GET /api/attendance/location
// @access  Private (Branch Admin, Admin, Super Admin)
const getLocationAttendance = asyncHandler(async (req, res) => {
  const { date, month, locationId } = req.query;
  const targetLocationId = req.user.role === 'branch_admin' ? req.user.assignedLocation : locationId;

  if (!targetLocationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  enforceLocationAccess(req, res, targetLocationId, 'Not authorized to view attendance for this location');

  let query = { locationId: targetLocationId };

  if (date) {
    query.date = date; // Exact match YYYY-MM-DD
  } else if (month) {
    // Month should be YYYY-MM format
    query.date = { $regex: `^${escapeRegex(month)}` };
  }

  const page = parseInt(req.query.page) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  const total = await Attendance.countDocuments(query);
  const attendance = await Attendance.find(query)
    .populate('user', 'name email role')
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    count: attendance.length,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
    data: attendance,
  });
});

// @desc    Get global attendance (all locations)
// @route   GET /api/attendance/all
// @access  Private (Admin, Super Admin)
const getAllAttendance = asyncHandler(async (req, res) => {
  const { date, month, userId, locationId } = req.query;

  let query = {};

  if (userId) query.user = userId;
  if (locationId && locationId !== 'All') {
    enforceLocationAccess(req, res, locationId, 'Not authorized to view attendance for this location');
    query.locationId = locationId;
  } else if (req.user.role === 'admin') {
    query.locationId = { $in: req.user.accessibleLocations || [] };
  }
  if (date) query.date = date;
  else if (month) query.date = { $regex: `^${escapeRegex(month)}` };

  const page = parseInt(req.query.page) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  const total = await Attendance.countDocuments(query);
  const attendance = await Attendance.find(query)
    .populate('user', 'name email role assignedLocation')
    .populate('locationId', 'name')
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    count: attendance.length,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
    data: attendance.map(att => {
      const attObj = att.toObject ? att.toObject() : att;
      return {
        ...attObj,
        locationName: att.locationId?.name || 'Unknown'
      };
    }),
  });
});

// @desc    Get monthly summary (staff count, present days, absent days, salary payout)
// @route   GET /api/attendance/monthly-summary
// @access  Private (Admin, Super Admin)
const getMonthlySummary = asyncHandler(async (req, res) => {
  const { month, locationId } = req.query; // Format YYYY-MM
  if (!month) {
    res.status(400);
    throw new Error('Month parameter (YYYY-MM) is required');
  }

  let userMatch = { role: 'staff' };
  let attendanceMatch = { date: { $regex: `^${month}` } };

  if (locationId && locationId !== 'All') {
    if (mongoose.Types.ObjectId.isValid(locationId)) {
      enforceLocationAccess(req, res, locationId, 'Not authorized to view this summary');
      userMatch.assignedLocation = new mongoose.Types.ObjectId(locationId);
      attendanceMatch.locationId = new mongoose.Types.ObjectId(locationId);
    } else {
      // If invalid ID provided and not "All", return empty result safely
      return res.json({ success: true, data: [] });
    }
  } else if (req.user.role === 'admin') {
    userMatch.assignedLocation = { $in: req.user.accessibleLocations || [] };
    attendanceMatch.locationId = { $in: req.user.accessibleLocations || [] };
  }

  // 1. Get location-wise staff count & total monthly salaries
  const userAgg = await User.aggregate([
    { $match: userMatch },
    {
      $group: {
        _id: '$assignedLocation',
        totalStaff: { $sum: 1 },
        totalMonthlySalaries: { $sum: '$monthlySalary' }
      }
    }
  ]);

  // 2. Get attendance counts per location for the month
  const attendanceAgg = await Attendance.aggregate([
    { $match: attendanceMatch },
    {
      $group: {
        _id: '$locationId',
        totalPresent: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        totalAbsent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        totalHalfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
      }
    }
  ]);

  // Merge Data and Lookup Location Names
  const summary = await Promise.all(userAgg.map(async (uAgg) => {
    const attObj = attendanceAgg.find(a => a._id?.toString() === uAgg._id?.toString());
    const location = await Location.findById(uAgg._id);

    const present = attObj ? attObj.totalPresent : 0;
    const absent = attObj ? attObj.totalAbsent : 0;
    const halfDay = attObj ? attObj.totalHalfDay : 0;

    return {
      locationName: location?.name || 'Unknown',
      totalStaff: uAgg.totalStaff,
      totalPresentDays: present + (halfDay * 0.5),
      totalAbsentDays: absent + (halfDay * 0.5),
    };
  }));

  res.json({
    success: true,
    data: summary,
  });
});

const getMyAttendance = asyncHandler(async (req, res) => {
  const { month, startDate, endDate } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  let query = { user: req.user._id };

  if (month) {
    query.date = { $regex: `^${escapeRegex(month)}` };
  } else if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }

  const total = await Attendance.countDocuments(query);
  const attendance = await Attendance.find(query).sort({ date: -1 }).skip(skip).limit(limit);

  res.json({ 
    success: true, 
    count: attendance.length, 
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
    data: attendance 
  });
});

module.exports = {
  markAttendance,
  getLocationAttendance,
  getAllAttendance,
  getMonthlySummary,
  getMyAttendance
};
