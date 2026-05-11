const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('./models/Order');
const User = require('./models/User');
const Location = require('./models/Location');
const MenuItem = require('./models/MenuItem');
const Table = require('./models/Table');

dotenv.config();

async function seedOrders() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const count = await Order.countDocuments({ status: 'COMPLETED' });
    if (count > 0) {
      console.log('Orders already exist.');
      process.exit();
    }

    const admin = await User.findOne({ role: 'super_admin' });
    const location = await Location.findOne();
    const menuItem = await MenuItem.findOne();
    const table = await Table.findOne({ locationId: location?._id });

    if (!admin || !location || !menuItem || !table) {
      console.log('Missing dependencies for order seeding.');
      process.exit();
    }

    console.log('Seeding Completed Orders...');
    await Order.create([
      {
        branch: location._id,
        table: table._id,
        createdBy: admin._id,
        items: [{ menuItem: menuItem._id, quantity: 2 }],
        status: 'COMPLETED',
        totalAmount: 500,
        paymentType: 'UPI',
        createdAt: new Date()
      },
      {
        branch: location._id,
        table: table._id,
        createdBy: admin._id,
        items: [{ menuItem: menuItem._id, quantity: 1 }],
        status: 'COMPLETED',
        totalAmount: 250,
        paymentType: 'CASH',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ]);

    console.log('Order Seeding Complete');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedOrders();
