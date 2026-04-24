const mongoose = require('mongoose');
const dotenv = require('dotenv');
const MenuItem = require('./models/MenuItem');

dotenv.config();

const checkDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const count = await MenuItem.countDocuments();
    const items = await MenuItem.find().limit(5);
    console.log(`Total Menu Items: ${count}`);
    console.log('Sample Items:', JSON.stringify(items, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkDB();
