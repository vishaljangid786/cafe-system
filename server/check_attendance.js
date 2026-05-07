const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Attendance = require('./models/Attendance');

dotenv.config();

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const recent = await Attendance.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name');
    console.log(JSON.stringify(recent, null, 2));
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
