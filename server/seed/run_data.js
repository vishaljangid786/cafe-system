const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
dotenv.config();

const {
  locations, users, menuItems, categories,
  attendances, bookings, coupons, expenses, tables, notifications, recipes
} = require('./data');

const User = require('../models/User');
const Location = require('../models/Location');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Attendance = require('../models/Attendance');
const Booking = require('../models/Booking');
const Coupon = require('../models/Coupon');
const Expense = require('../models/Expense');
const Table = require('../models/Table');
const Notification = require('../models/Notification');
const Recipe = require('../models/Recipe');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
};

const seed = async () => {
  await connectDB();
  
  // Clear collections
  const collections = Object.keys(mongoose.connection.collections);
  for (const collectionName of collections) {
    await mongoose.connection.db.dropCollection(collectionName).catch(() => {});
  }
  
  console.log('Collections cleared');

  try {
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('password123', salt);
    
    let superAdmin = await User.create({
      name: 'Super Admin Seed',
      email: 'superadmin_seed@cafe.com'.toLowerCase(),
      password: 'password123',
      role: 'super_admin',
      phone: '9876543210',
      gender: 'Male',
      age: 35,
      address1: '123 Admin St',
      city: 'Global City',
      state: 'State',
      country: 'USA',
      aadharNumber: '123456789012',
      aadharImage: 'https://example.com/aadhar.jpg',
      highestQualification: 'Post Graduate'
    });

    const locsToInsert = locations.map(l => ({ ...l, createdBy: superAdmin._id }));
    const insertedLocs = await Location.insertMany(locsToInsert);

    const usersToInsert = users.map(u => {
      let assignedLocation = null;
      if (u.locationName) {
        const loc = insertedLocs.find(l => l.name === u.locationName);
        if (loc) assignedLocation = loc._id;
      } else {
        assignedLocation = insertedLocs[0]._id;
      }
      return {
        ...u,
        password: password,
        aadharImage: 'https://example.com/aadhar.jpg',
        assignedLocation: assignedLocation,
        monthlySalary: u.monthlySalary || 20000,
        email: (u.email === 'superadmin@cafe.com' ? 'superadmin_old@cafe.com' : u.email).toLowerCase()
      };
    });
    const insertedUsers = await User.insertMany(usersToInsert.filter(u => u.role !== 'super_admin'));

    const insertedCats = await Category.insertMany(categories.map(c => ({
      name: c,
      createdBy: superAdmin._id
    })));

    const itemsToInsert = menuItems.map(m => ({
      ...m,
      name: m.itemName,
      category: insertedCats[0]._id,
      createdBy: superAdmin._id
    }));
    const insertedItems = await MenuItem.insertMany(itemsToInsert);

    await Attendance.insertMany(attendances.map((a, i) => ({
      ...a, 
      locationId: insertedLocs[0]._id, 
      user: insertedUsers[0]._id, 
      markedBy: superAdmin._id,
      date: `2026-04-${String(i + 1).padStart(2, '0')}`
    })));

    await Booking.insertMany(bookings.map((b, i) => ({
      ...b, 
      locationId: insertedLocs[0]._id, 
      userId: insertedUsers[0]._id,
      date: new Date(`2026-04-${String(i + 1).padStart(2, '0')}`)
    })));

    await Coupon.insertMany(coupons.map(c => ({...c, createdBy: superAdmin._id})));
    await Expense.insertMany(expenses.map(e => ({...e, locationId: insertedLocs[0]._id, createdBy: superAdmin._id})));
    await Table.insertMany(tables.map((t, i) => ({...t, tableNumber: i + 1, locationId: insertedLocs[0]._id, createdBy: superAdmin._id})));
    await Notification.insertMany(notifications.map(n => ({...n, createdBy: superAdmin._id})));
    
    await Recipe.insertMany(recipes.map((r, i) => ({
      ...r, 
      menuItemId: insertedItems[i] ? insertedItems[i]._id : insertedItems[0]._id, 
      createdBy: superAdmin._id
    })));
    
    console.log('Successfully seeded data.js into the database.');
  } catch (err) {
    console.error('Error seeding:', err.message);
  }
  
  process.exit(0);
};

seed();
