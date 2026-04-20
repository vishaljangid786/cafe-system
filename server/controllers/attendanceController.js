const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');

// Helper to validate date format (YYYY-MM-DD)
const isValidDate = (dateString) => {
  const regEx = /^\d{4}-\d{2}-\d{2}$/;
  return dateString.match(regEx) != null;
};

// @desc    Mark daily attendance
// @route   POST /api/attendance/mark
// @access  Private (Location Admin)
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

  // Location Admins can only mark for today
  if (req.user.role === 'location_admin' && date !== today) {
    res.status(403);
    throw new Error('Location Admins can only mark or edit attendance for the current day. Contact Admin for past corrections.');
  }

  // Validate user
  const staff = await User.findById(userId);
  if (!staff) {
    res.status(404);
    throw new Error('User not found');
  }

  // Ensure location admin is marking for their own location
  if (req.user.role === 'location_admin' && staff.assignedLocation?.toString() !== req.user.assignedLocation?.toString()) {
    res.status(403);
    throw new Error('Not authorized to mark attendance for personnel of another location');
  }

  const targetLocationId = staff.assignedLocation;
  if (!targetLocationId) {
    res.status(400);
    throw new Error('Target personnel has no assigned location');
  }

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
// @access  Private (Location Admin, Admin, Super Admin)
const getLocationAttendance = asyncHandler(async (req, res) => {
  const { date, month, locationId } = req.query;
  const targetLocationId = req.user.role === 'location_admin' ? req.user.assignedLocation : locationId;

  if (!targetLocationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  let query = { locationId: targetLocationId };

  if (date) {
    query.date = date; // Exact match YYYY-MM-DD
  } else if (month) {
    // Month should be YYYY-MM format
    query.date = { $regex: `^${month}` }; 
  }

  const attendance = await Attendance.find(query).populate('user', 'name email role');

  res.json({
    success: true,
    count: attendance.length,
    data: attendance,
  });
});

// @desc    Get global attendance (all locations)
// @route   GET /api/attendance/all
// @access  Private (Admin, Super Admin)
const getAllAttendance = asyncHandler(async (req, res) => {
  const { date, month, userId } = req.query;
  
  let query = {};
  
  if (userId) query.user = userId;
  if (date) query.date = date;
  else if (month) query.date = { $regex: `^${month}` };

  const attendance = await Attendance.find(query)
    .populate('user', 'name email role assignedLocation')
    .populate('locationId', 'name')
    .sort({ date: -1 });

  res.json({
    success: true,
    count: attendance.length,
    data: attendance.map(att => ({
      ...att._doc,
      locationName: att.locationId?.name || 'Unknown'
    })),
  });
});

// @desc    Get monthly summary (staff count, present days, absent days, salary payout)
// @route   GET /api/attendance/monthly-summary
// @access  Private (Admin, Super Admin)
const getMonthlySummary = asyncHandler(async (req, res) => {
  const { month } = req.query; // Format YYYY-MM
  if (!month) {
    res.status(400);
    throw new Error('Month parameter (YYYY-MM) is required');
  }

  // 1. Get location-wise staff count & total monthly salaries
  const userAgg = await User.aggregate([
    { $match: { role: 'staff' } },
    { $group: { 
        _id: '$assignedLocation', 
        totalStaff: { $sum: 1 },
        totalMonthlySalaries: { $sum: '$monthlySalary' } 
      }
    }
  ]);

  // 2. Get attendance counts per location for the month
  const attendanceAgg = await Attendance.aggregate([
    { $match: { date: { $regex: `^${month}` } } },
    { $group: {
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

module.exports = {
  markAttendance,
  getLocationAttendance,
  getAllAttendance,
  getMonthlySummary,
};
