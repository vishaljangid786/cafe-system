const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function getToken() {
  await mongoose.connect(process.env.MONGO_URI);
  const admin = await User.findOne({ role: 'super_admin' });
  if (!admin) {
    console.log('No super_admin found');
    process.exit(1);
  }
  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  console.log('TOKEN:', token);
  await mongoose.disconnect();
}

getToken();
