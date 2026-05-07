const mongoose = require('mongoose');

async function get_users() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cafe-system');
    const User = mongoose.model('User', new mongoose.Schema({
      email: String,
      role: String,
      isBlocked: Boolean
    }));
    const users = await User.find({ isBlocked: { $ne: true } }).lean();
    console.log(JSON.stringify(users, null, 2));
    await mongoose.disconnect();
  } catch (error) {
    console.error(error);
  }
}

get_users();
