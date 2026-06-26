const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { enforceLocationAccess, canAccessLocation, clampLimit, escapeRegex, scopedLocationId, userLocationIds } = require('../utils/accessControl');
const { getSettings, num } = require('../utils/settings');

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

  // Branch-level operators can ONLY mark for today (Strict Lockdown)
  if (['branch_admin', 'location_admin'].includes(req.user.role) && date !== today) {
    res.status(403);
    throw new Error('Attendance Lockdown: Branch operators can only mark or edit records for the CURRENT DAY. Contact an administrator for retroactive corrections.');
  }

  // Validate user
  const staff = await User.findById(userId);
  if (!staff) {
    res.status(404);
    throw new Error('User not found');
  }

  // Ensure branch-level operators are marking for their own location
  if (['branch_admin', 'location_admin'].includes(req.user.role) && !canAccessLocation(req.user, staff.assignedLocation)) {
    res.status(403);
    throw new Error('You do not have permission to mark attendance for personnel of another location');
  }

  const targetLocationId = staff.assignedLocation;
  if (!targetLocationId) {
    res.status(400);
    throw new Error('Target personnel has no assigned location');
  }

  enforceLocationAccess(req, res, targetLocationId, 'You do not have permission to mark attendance for this location');

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
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
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
  const targetLocationId = scopedLocationId(req, locationId);
  if (!targetLocationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

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
    enforceLocationAccess(req, res, locationId, 'You do not have permission to view attendance for this location');
    query.locationId = locationId;
  } else if (['admin', 'branch_admin', 'location_admin'].includes(req.user.role)) {
    query.locationId = { $in: userLocationIds(req.user) };
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
  let attendanceMatch = { date: { $regex: `^${escapeRegex(month)}` } };

  if (locationId && locationId !== 'All') {
    if (mongoose.Types.ObjectId.isValid(locationId)) {
      enforceLocationAccess(req, res, locationId, 'You do not have permission to view this summary');
      userMatch.assignedLocation = new mongoose.Types.ObjectId(locationId);
      attendanceMatch.locationId = new mongoose.Types.ObjectId(locationId);
    } else {
      // If invalid ID provided and not "All", return empty result safely
      return res.json({ success: true, data: [] });
    }
  } else if (['admin', 'branch_admin', 'location_admin'].includes(req.user.role)) {
    const ids = userLocationIds(req.user);
    userMatch.assignedLocation = { $in: ids };
    attendanceMatch.locationId = { $in: ids };
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

// --- Self-service clock-in / clock-out ---------------------------------------
// Business timezone for "today" + late detection (cafe runs in IST). Using a
// fixed zone avoids the UTC-on-serverless day/late drift.
const BUSINESS_TZ = 'Asia/Kolkata';
const SHIFT_START = '09:00'; // default shift start
const GRACE_MINUTES = 10;

const istDateStr = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ }); // YYYY-MM-DD
const istTimeStr = (d = new Date()) => d.toLocaleTimeString('en-GB', { timeZone: BUSINESS_TZ, hour12: false }).slice(0, 5); // HH:mm
const addMinutesToHHMM = (hhmm, mins) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor((total % 1440) / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
};

// @desc    Staff/chef clock IN for today
// @route   POST /api/attendance/check-in
// @access  Private (self)
const checkIn = asyncHandler(async (req, res) => {
  const locationId = req.user.assignedLocation;
  if (!locationId) {
    res.status(400);
    throw new Error('You have no assigned location to mark attendance for');
  }

  const date = istDateStr();
  const existing = await Attendance.findOne({ user: req.user._id, date });
  if (existing && existing.checkIn) {
    res.status(400);
    throw new Error('You have already checked in today');
  }

  const now = new Date();
  // Configurable shift start + grace for this branch. graceMinutes of 0 (strict
  // on-time) is a legitimate value, so preserve it via num() rather than `|| 10`.
  const cfg = (await getSettings(locationId)).payroll;
  const isLate = istTimeStr(now) > addMinutesToHHMM(cfg.shiftStart || SHIFT_START, num(cfg.graceMinutes, GRACE_MINUTES));

  const attendance = await Attendance.findOneAndUpdate(
    { user: req.user._id, date },
    {
      $set: {
        user: req.user._id,
        locationId,
        date,
        status: 'present',
        checkIn: now,
        isLate,
        markedBy: req.user._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await sendNotification({
    title: 'Checked in',
    message: `A shift was checked in by ${req.user.name}.`,
    type: 'activity',
    priority: 'low',
    performedByUser: req.user,
    locationId,
  });

  res.json({ success: true, data: attendance, late: isLate });
});

// @desc    Staff/chef clock OUT for today
// @route   POST /api/attendance/check-out
// @access  Private (self)
const checkOut = asyncHandler(async (req, res) => {
  const date = istDateStr();
  const attendance = await Attendance.findOne({ user: req.user._id, date });
  if (!attendance || !attendance.checkIn) {
    res.status(400);
    throw new Error('You have not checked in today');
  }
  if (attendance.checkOut) {
    res.status(400);
    throw new Error('You have already checked out today');
  }

  const now = new Date();
  attendance.checkOut = now;
  attendance.workedMinutes = Math.max(0, Math.round((now.getTime() - new Date(attendance.checkIn).getTime()) / 60000));
  // Auto-mark half-day if less than the configured threshold was worked (manual
  // status edits win for absent; we only refine a 'present' record). A threshold
  // of 0 disables the auto-downgrade, so preserve it via num() rather than `|| 240`.
  const halfThreshold = num((await getSettings(attendance.locationId)).payroll.halfDayThresholdMinutes, 240);
  if (attendance.status === 'present' && attendance.workedMinutes > 0 && halfThreshold > 0 && attendance.workedMinutes < halfThreshold) {
    attendance.status = 'half-day';
  }
  await attendance.save();

  await sendNotification({
    title: 'Checked out',
    message: `A shift was checked out by ${req.user.name}.`,
    type: 'activity',
    priority: 'low',
    performedByUser: req.user,
    locationId: attendance.locationId,
  });

  res.json({ success: true, data: attendance });
});

module.exports = {
  markAttendance,
  getLocationAttendance,
  getAllAttendance,
  getMonthlySummary,
  getMyAttendance,
  checkIn,
  checkOut,
};
