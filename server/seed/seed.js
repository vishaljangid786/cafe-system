const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { faker } = require('@faker-js/faker');

// Load env vars
dotenv.config();

// Import Models
const User = require('../models/User');
const Location = require('../models/Location');
const Table = require('../models/Table');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Coupon = require('../models/Coupon');
const Booking = require('../models/Booking');
const Expense = require('../models/Expense');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const Recipe = require('../models/Recipe');

const SEED_PASSWORD = 'password123';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`📡 Connected to Node: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ Connection Failure: ${error.message}`);
    process.exit(1);
  }
};

const clearCollections = async (conn) => {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('🚫 DANGER: Cannot reset production database without --force flag.');
    process.exit(1);
  }

  console.log('🗑️  Initiating data purge (Dropping collections to clear legacy indexes)...');
  
  const collections = Object.keys(conn.connection.collections);
  for (const collectionName of collections) {
    try {
      await conn.connection.db.dropCollection(collectionName);
      console.log(`  ✔ Dropped ${collectionName}`);
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') {
        console.warn(`  ⚠ Could not drop ${collectionName}: ${err.message}`);
      }
    }
  }
  console.log('✔ All collections purged.');
};

const createDummyUser = (overrides = {}) => {
  const role = overrides.role || 'staff';
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: SEED_PASSWORD,
    phone: faker.string.numeric(10),
    gender: faker.helpers.arrayElement(['Male', 'Female']),
    age: faker.number.int({ min: 18, max: 50 }),
    address1: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state(),
    country: 'India',
    aadharNumber: faker.string.numeric(12),
    aadharImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg',
    highestQualification: faker.helpers.arrayElement(['12th Pass', 'Diploma', 'Graduate', 'Post Graduate']),
    role: role,
    monthlySalary: role === 'staff' ? 18000 : (role === 'location_admin' ? 35000 : undefined),
    ...overrides
  };
};

const seedData = async () => {
  try {
    const conn = await connectDB();
    await clearCollections(conn);

    // 1. Seed Locations
    console.log('📍 Seeding Locations...');
    const locationsData = [
      { city: 'Jaipur', name: 'MI Road Hub', state: 'Rajasthan', pincode: '302001', country: 'India', geoCoordinates: { lat: 26.9124, lng: 75.7873 }, maxCapacity: 40 },
      { city: 'Delhi', name: 'Connaught Place Node', state: 'Delhi', pincode: '110001', country: 'India', geoCoordinates: { lat: 28.6304, lng: 77.2177 }, maxCapacity: 60 },
      { city: 'Mumbai', name: 'Andheri West Terminal', state: 'Maharashtra', pincode: '400053', country: 'India', geoCoordinates: { lat: 19.1136, lng: 72.8697 }, maxCapacity: 50 },
    ];
    
    const superAdmin = await User.create(createDummyUser({ name: 'Super Admin', email: 'super@cafeos.com', role: 'super_admin' }));
    const locations = await Location.insertMany(locationsData.map(loc => ({ ...loc, createdBy: superAdmin._id })));
    console.log(`✔ ${locations.length} Locations seeded.`);

    // 2. Seed Users
    console.log('👤 Seeding Users...');
    const usersData = [];
    for (const loc of locations) {
      usersData.push(createDummyUser({ name: `Admin ${loc.city}`, email: `admin.${loc.city.toLowerCase()}@cafeos.com`, role: 'admin', accessibleLocations: [loc._id] }));
      usersData.push(createDummyUser({ name: `Lead ${loc.city}`, email: `lead.${loc.city.toLowerCase()}@cafeos.com`, role: 'location_admin', assignedLocation: loc._id }));
      for (let i = 1; i <= 3; i++) {
        usersData.push(createDummyUser({ name: `${loc.city} Staff ${i}`, email: `staff${i}.${loc.city.toLowerCase()}@cafeos.com`, role: 'staff', assignedLocation: loc._id }));
      }
    }
    const seededUsers = await User.insertMany(usersData);
    console.log(`✔ ${seededUsers.length + 1} Personnel nodes initialized.`);

    // 3. Seed Categories
    console.log('🍽️  Seeding Categories...');
    const categoriesData = [
      { name: 'Coffee', description: 'Premium artisanal brews', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085', createdBy: superAdmin._id },
      { name: 'Beverages', description: 'Refreshing cold implementations', image: 'https://images.unsplash.com/photo-1544145945-f904253d0c71', createdBy: superAdmin._id },
      { name: 'Snacks', description: 'Rapid nutritional units', image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5', createdBy: superAdmin._id },
      { name: 'Desserts', description: 'Final sequence sweet nodes', image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b', createdBy: superAdmin._id },
    ];
    const categories = await Category.insertMany(categoriesData);
    console.log(`✔ ${categories.length} Categories seeded.`);

    // 4. Seed Menu Items
    console.log('🍕 Seeding Menu Items...');
    const menuItemsData = [];
    const itemTemplates = {
      'Coffee': [{ name: 'Cappuccino', price: 180 }, { name: 'Latte', price: 200 }, { name: 'Espresso', price: 120 }],
      'Beverages': [{ name: 'Cold Coffee', price: 220 }, { name: 'Peach Tea', price: 150 }],
      'Snacks': [{ name: 'Sandwich', price: 250 }, { name: 'Fries', price: 140 }],
      'Desserts': [{ name: 'Brownie', price: 180 }, { name: 'Cheesecake', price: 280 }]
    };
    for (const cat of categories) {
      const templates = itemTemplates[cat.name] || [];
      for (const t of templates) {
        menuItemsData.push({
          name: t.name, category: cat._id, price: t.price, originalPrice: t.price + 50, discountedPrice: t.price,
          description: faker.commerce.productDescription(), preparationTime: faker.number.int({ min: 5, max: 15 }),
          image: `https://loremflickr.com/320/240/${t.name.toLowerCase()}`, isAvailable: true, createdBy: superAdmin._id
        });
      }
    }
    await MenuItem.insertMany(menuItemsData);
    console.log('✔ Culinary nodes seeded.');

    // 5. Seed Tables
    console.log('🪑 Seeding Tables...');
    const tablesData = [];
    for (const loc of locations) {
      for (let i = 1; i <= 10; i++) {
        tablesData.push({ tableNumber: i, locationId: loc._id, status: 'available', createdBy: superAdmin._id });
      }
    }
    await Table.insertMany(tablesData);
    console.log(`✔ ${tablesData.length} Operational terminals initialized.`);

    // 6. Seed Coupons
    console.log('🎟️  Seeding Coupons...');
    await Coupon.insertMany([
      { code: 'WELCOME10', discountType: 'percentage', discountValue: 10, expiryDate: new Date('2026-12-31'), createdBy: superAdmin._id },
      { code: 'FLAT50', discountType: 'fixed', discountValue: 50, minOrderAmount: 300, expiryDate: new Date('2026-12-31'), createdBy: superAdmin._id }
    ]);
    console.log('✔ Promotion protocols initialized.');

    // 7. Seed Bookings
    console.log('📅 Seeding Bookings...');
    const staffUser = seededUsers.find(u => u.role === 'staff');
    await Booking.create({
      userId: staffUser._id, locationId: locations[0]._id, date: new Date(), startTime: '18:00', endTime: '20:00', numberOfGuests: 4, status: 'confirmed'
    });
    console.log('✔ Sample bookings seeded.');

    // 8. Seed Expenses & Attendance
    console.log('💸 Seeding Fiscal & Personnel Data...');
    const expensesData = locations.map(loc => ({
      title: 'Daily Supplies', description: 'Recurring inventory replenishment', amount: faker.number.int({ min: 1000, max: 5000 }),
      category: 'Kitchen', locationId: loc._id, date: new Date(), createdBy: superAdmin._id,
      proofImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg'
    }));
    await Expense.insertMany(expensesData);

    const attendanceData = seededUsers.filter(u => u.role === 'staff').map(u => ({
      user: u._id, locationId: u.assignedLocation, date: new Date().toISOString().split('T')[0],
      status: 'present', markedBy: superAdmin._id
    }));
    await Attendance.insertMany(attendanceData);
    console.log('✔ Fiscal yields and attendance logs initialized.');

    console.log('\n✨ Database Seeding Complete. Operational Matrix Ready.');
    process.exit();
  } catch (error) {
    console.error(`❌ Seeding Error: ${error.message}`);
    process.exit(1);
  }
};

seedData();
