const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
dotenv.config();

const User = require('./models/User');

const check = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'superadmin_seed@gmail.com' });
  if (user) {
    console.log('User found:', user.email);
    const match = await bcrypt.compare('password123', user.password);
    console.log('Password match:', match);
    console.log('Stored Hash:', user.password);
  } else {
    console.log('User not found');
  }
  process.exit(0);
};

check();
