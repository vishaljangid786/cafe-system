const mongoose = require('mongoose');
const User = require('./models/User');
const Location = require('./models/Location');
const Attendance = require('./models/Attendance');
const AuditLog = require('./models/AuditLog');
require('dotenv').config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({ role: { $in: ['staff', 'chef', 'branch_admin', 'admin', 'super_admin'] } });
    const locations = await Location.find({});
    const admins = users.filter(u => ['admin', 'super_admin', 'branch_admin'].includes(u.role));

    if (users.length === 0 || locations.length === 0 || admins.length === 0) {
      console.log('Missing required data for seeding');
      process.exit(1);
    }

    const attendanceData = [];
    const auditLogs = [];
    const today = new Date();
    
    // Seed for last 14 days
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      // Use IST (Asia/Kolkata) date keys to match live clock-in (attendanceController
      // istDateStr) and the UI — toISOString() yields a UTC day that can be off-by-one.
      const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      users.filter(u => ['staff', 'chef', 'branch_admin'].includes(u.role)).forEach(user => {
        const rand = Math.random();
        const status = rand < 0.85 ? 'present' : rand < 0.95 ? 'absent' : 'half-day';
        const marker = admins[Math.floor(Math.random() * admins.length)];
        const locationId = user.assignedLocation || locations[0]._id;

        attendanceData.push({
          user: user._id,
          locationId: locationId,
          date: dateStr,
          status: status,
          markedBy: marker._id
        });
      });

      // Seed Audit Logs for each day
      const actions = ['USER_LOGIN', 'ORDER_CREATED', 'MENU_UPDATED', 'STOCK_ADJUSTED', 'STAFF_PROMOTED'];
      for (let j = 0; j < 5; j++) {
        const performer = users[Math.floor(Math.random() * users.length)];
        auditLogs.push({
          action: actions[Math.floor(Math.random() * actions.length)],
          performedBy: performer._id,
          role: performer.role,
          details: { message: `Automated audit log entry ${j} for ${dateStr}` },
          timestamp: new Date(date.getTime() + Math.random() * 86400000)
        });
      }
    }

    await Attendance.deleteMany({});
    await AuditLog.deleteMany({});
    console.log('Cleared existing data');

    await Attendance.insertMany(attendanceData);
    await AuditLog.insertMany(auditLogs);
    console.log(`Successfully seeded ${attendanceData.length} attendance records and ${auditLogs.length} audit logs`);

  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
