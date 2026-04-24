const mongoose = require('mongoose');
const Order = require('./server/models/Order');
const Location = require('./server/models/Location');
require('dotenv').config({ path: './server/.env' });

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const orderCount = await Order.countDocuments();
    console.log('Total Orders:', orderCount);

    const locations = await Location.find({}, 'name city');
    console.log('Locations:', locations);

    if (orderCount > 0) {
      const sampleOrder = await Order.findOne().populate('branch', 'name');
      console.log('Sample Order Branch:', sampleOrder.branch?.name);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
