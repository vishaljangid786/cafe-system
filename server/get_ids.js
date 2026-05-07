const mongoose = require('mongoose');
const User = require('./models/User');
const Location = require('./models/Location');
require('dotenv').config();

async function getIds() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({ role: { $in: ['staff', 'chef', 'branch_admin'] } }).limit(5);
  const locations = await Location.find({}).limit(2);
  const admins = await User.find({ role: 'admin' }).limit(1);

  console.log('USERS:', JSON.stringify(users.map(u => ({ id: u._id, name: u.name, location: u.assignedLocation })), null, 2));
  console.log('LOCATIONS:', JSON.stringify(locations.map(l => ({ id: l._id, name: l.name })), null, 2));
  console.log('ADMINS:', JSON.stringify(admins.map(a => ({ id: a._id, name: a.name })), null, 2));

  await mongoose.disconnect();
}

getIds();
