require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Location = require('../models/Location');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Transaction = require('../models/Transaction');
const Attendance = require('../models/Attendance');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cafe-os';

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // 1. Get or Create Super Admin
    let superAdmin = await User.findOne({ email: 'super@cafeos.com' });
    if (!superAdmin) {
      console.log('Super Admin not found. Please run the initial setup first or create super@cafeos.com.');
      // return;
      // Alternatively, create a dummy super admin if needed, but we expect one to exist from earlier tasks.
    }
    
    const adminId = superAdmin ? superAdmin._id : new mongoose.Types.ObjectId();

    // 2. Create Locations
    const locationData = [
      { name: 'Downtown Hub', city: 'Jaipur', state: 'Rajasthan', pincode: '302001', country: 'India', createdBy: adminId },
      { name: 'Riverside Cafe', city: 'Delhi', state: 'Delhi', pincode: '110001', country: 'India', createdBy: adminId },
      { name: 'Mountain View', city: 'Manali', state: 'Himachal', pincode: '175131', country: 'India', createdBy: adminId }
    ];

    const locations = [];
    for (const loc of locationData) {
      let existing = await Location.findOne({ name: loc.name });
      if (!existing) {
        existing = await Location.create(loc);
        console.log(`Created location: ${loc.name}`);
      }
      locations.push(existing);
    }

    // 3. Create Categories
    const categoryData = [
      { name: 'Beverages', description: 'Hot and Cold drinks', createdBy: adminId },
      { name: 'Snacks', description: 'Quick bites', createdBy: adminId },
      { name: 'Main Course', description: 'Full meals', createdBy: adminId }
    ];

    const categories = [];
    for (const cat of categoryData) {
      let existing = await Category.findOne({ name: cat.name });
      if (!existing) {
        existing = await Category.create(cat);
        console.log(`Created category: ${cat.name}`);
      }
      categories.push(existing);
    }

    // 4. Create Menu Items
    const menuItems = [];
    for (const loc of locations) {
      for (const cat of categories) {
        const items = [
          { name: `${cat.name} Item 1`, price: 150, costPrice: 50, category: cat._id, locationId: loc._id, createdBy: adminId },
          { name: `${cat.name} Item 2`, price: 250, costPrice: 100, category: cat._id, locationId: loc._id, createdBy: adminId }
        ];
        for (const item of items) {
          let existing = await MenuItem.findOne({ name: item.name, locationId: loc._id });
          if (!existing) {
            existing = await MenuItem.create(item);
          }
          menuItems.push(existing);
        }
      }
    }
    console.log('Menu items seeded.');

    // 4.5. Create Staff Users
    const staffMembers = [];
    const staffNames = ['Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince', 'Ethan Hunt'];
    for (let i = 0; i < staffNames.length; i++) {
      const email = `staff${i+1}@test.com`;
      let existing = await User.findOne({ email });
      if (!existing) {
        existing = await User.create({
          name: staffNames[i],
          email,
          password: 'password123',
          phone: `999999990${i}`,
          gender: 'Other',
          age: 25,
          address1: 'Staff Quarter',
          city: 'Jaipur',
          state: 'Rajasthan',
          country: 'India',
          role: 'staff',
          assignedLocation: locations[i % locations.length]._id,
          aadharNumber: `12345678901${i}`,
          aadharImage: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
          highestQualification: 'Graduate',
          monthlySalary: 25000
        });
        console.log(`Created staff: ${staffNames[i]}`);
      }
      staffMembers.push(existing);
    }

    // 4.6. Seed Attendance (Last 7 days)
    console.log('Seeding attendance for last 7 days...');
    const statuses = ['present', 'absent', 'half-day'];
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      
      for (const staff of staffMembers) {
        try {
          await Attendance.create({
            user: staff._id,
            locationId: staff.assignedLocation,
            date: dateStr,
            status: statuses[Math.floor(Math.random() * statuses.length * 0.7)], // biased towards present
            markedBy: adminId
          });
        } catch (e) {
          // Likely duplicate index, ignore
        }
      }
    }

    // 5. Create Transactions (Seed for last 30 days)
    console.log('Seeding 150 transactions across 30 days...');
    const types = ['pos_revenue', 'manual_revenue', 'expense'];
    const expenseCategories = ['Rent', 'Electricity', 'Inventory', 'Salary', 'Marketing'];
    const revenueCategories = ['Catering', 'Event', 'Gift Card', 'Other'];

    for (let i = 0; i < 150; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const loc = locations[Math.floor(Math.random() * locations.length)];
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      let amount = 0;
      let profit = 0;
      let title = '';
      let category = '';
      let orders = [];

      if (type === 'pos_revenue') {
        const item = menuItems.find(mi => mi.locationId.equals(loc._id));
        const qty = Math.floor(Math.random() * 5) + 1;
        amount = item.price * qty;
        profit = (item.price - item.costPrice) * qty;
        title = `Order for Table ${Math.floor(Math.random() * 10) + 1}`;
        category = 'POS Order';
        orders = [{
          menuItemId: item._id,
          itemName: item.name,
          quantity: qty,
          price: item.price,
          costPrice: item.costPrice
        }];
      } else if (type === 'manual_revenue') {
        amount = Math.floor(Math.random() * 5000) + 1000;
        profit = amount; // Pure profit for manual revenue as a simple seed
        title = `Bulk Order - ${revenueCategories[Math.floor(Math.random() * revenueCategories.length)]}`;
        category = revenueCategories[Math.floor(Math.random() * revenueCategories.length)];
      } else {
        amount = Math.floor(Math.random() * 2000) + 200;
        profit = -amount; // Expense reduces profit
        title = `Payment for ${expenseCategories[Math.floor(Math.random() * expenseCategories.length)]}`;
        category = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
      }

      await Transaction.create({
        locationId: loc._id,
        type,
        title,
        category,
        totalAmount: amount,
        totalProfit: profit,
        date,
        orders,
        createdBy: adminId,
        tableNumber: type === 'pos_revenue' ? Math.floor(Math.random() * 10) + 1 : undefined,
        staffId: staffMembers[Math.floor(Math.random() * staffMembers.length)]._id 
      });
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
};

seedData();
