const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Location = require('../models/Location');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.post('/attendance', verifyToken, authorizeRoles('admin', 'super_admin'), asyncHandler(async (req, res) => {
  const users = await User.find({ role: { $in: ['staff', 'chef', 'branch_admin', 'admin', 'super_admin'] } });
  const locations = await Location.find({});
  const admins = users.filter(u => ['admin', 'super_admin', 'branch_admin'].includes(u.role));

  if (users.length === 0) {
    return res.status(400).json({ success: false, message: 'No users found to seed attendance for.' });
  }

  const attendanceData = [];
  const auditLogs = [];
  const today = new Date();
  
  // Seed for last 14 days
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    users.filter(u => ['staff', 'chef', 'branch_admin'].includes(u.role)).forEach(user => {
      const rand = Math.random();
      const status = rand < 0.85 ? 'present' : rand < 0.95 ? 'absent' : 'half-day';
      const marker = admins[Math.floor(Math.random() * admins.length)] || users[0];
      const locationId = user.assignedLocation || (locations.length > 0 ? locations[0]._id : null);

      if (locationId) {
        attendanceData.push({
          user: user._id,
          locationId: locationId,
          date: dateStr,
          status: status,
          markedBy: marker._id
        });
      }
    });

    const actions = ['USER_LOGIN', 'ORDER_CREATED', 'MENU_UPDATED', 'STOCK_ADJUSTED', 'STAFF_PROMOTED'];
    for (let j = 0; j < 5; j++) {
      const performer = users[Math.floor(Math.random() * users.length)];
      auditLogs.push({
        action: actions[Math.floor(Math.random() * actions.length)],
        performedBy: performer._id,
        role: performer.role,
        details: `Automated log for ${dateStr}`,
        timestamp: new Date(date.getTime() + Math.random() * 86400000)
      });
    }
  }

  await Attendance.deleteMany({});
  await AuditLog.deleteMany({});
  
  await Attendance.insertMany(attendanceData);
  await AuditLog.insertMany(auditLogs);

  res.json({
    success: true,
    message: `Successfully seeded ${attendanceData.length} records.`
  });
}));

module.exports = router;
