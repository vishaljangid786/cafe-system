const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AuditLog = require('../models/AuditLog');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');

dotenv.config();

async function checkAndSeed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    const logsCount = await AuditLog.countDocuments();
    const attendanceCount = await Attendance.countDocuments();

    console.log(`Audit Logs: ${logsCount}`);
    console.log(`Attendance Records: ${attendanceCount}`);

    const admin = await User.findOne({ role: 'super_admin' });
    const users = await User.find({ role: { $in: ['staff', 'chef'] } }).limit(5);
    const locations = await Location.find().limit(2);

    if (logsCount === 0 && admin) {
      console.log('Seeding Audit Logs...');
      await AuditLog.create([
        { action: 'LOGIN', performedBy: admin._id, details: 'Super Admin logged into the system', timestamp: new Date() },
        { action: 'PROMOTE_USER', performedBy: admin._id, details: 'User promoted to Branch Admin', timestamp: new Date() }
      ]);
    }

    if (attendanceCount === 0 && users.length > 0 && locations.length > 0) {
      console.log('Seeding Attendance...');
      const records = [];
      const today = new Date().toISOString().split('T')[0];
      for (const user of users) {
        records.push({
          user: user._id,
          locationId: user.assignedLocation || locations[0]._id,
          locationName: locations[0].name,
          date: today,
          status: Math.random() > 0.2 ? 'present' : 'absent',
          markedBy: admin?._id || users[0]._id
        });
      }
      await Attendance.insertMany(records);
    }

    console.log('Database Check/Seed Complete');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAndSeed();
