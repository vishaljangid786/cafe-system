const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { faker } = require('@faker-js/faker');

// Load env vars
dotenv.config();

// Import Models
const User = require('../models/User');
const Location = require('../models/Location');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const Attendance = require('../models/Attendance');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
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

const resetDB = async () => {
  console.log('🧹 PHASE 1: INITIATING COMPLETE DATABASE RESET...');
  try {
    // Manually delete collections to avoid potential dropDatabase issues in some environments
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
      console.log(`  ✔ Purged collection: ${collection.collectionName}`);
    }
    console.log('✔ Database purged successfully.');
  } catch (error) {
    console.log('❌ Reset failed:', error.message);
  }
};

const seedLocations = async (adminId) => {
  console.log('📍 Seeding Locations...');
  const locations = [
    { 
      name: 'Central Hub', city: 'Jaipur', address: 'MI Road, Near Central Park', 
      pincode: '302001', state: 'Rajasthan', country: 'India', 
      maxCapacity: 150, status: 'active', createdBy: adminId,
      geoCoordinates: { lat: 26.9124, lng: 75.7873 }
    },
    { 
      name: 'Garden Bistro', city: 'Jaipur', address: 'Malviya Nagar, Sector 5', 
      pincode: '302017', state: 'Rajasthan', country: 'India', 
      maxCapacity: 100, status: 'active', createdBy: adminId,
      geoCoordinates: { lat: 26.8530, lng: 75.8047 }
    },
    { 
      name: 'Skyline Terrace', city: 'Jaipur', address: 'Vaishali Nagar, Amrapali Circle', 
      pincode: '302021', state: 'Rajasthan', country: 'India', 
      maxCapacity: 120, status: 'active', createdBy: adminId,
      geoCoordinates: { lat: 26.9075, lng: 75.7395 }
    },
    { 
      name: 'Vintage Station', city: 'Jaipur', address: 'Mansarovar, Shipra Path', 
      pincode: '302020', state: 'Rajasthan', country: 'India', 
      maxCapacity: 180, status: 'active', createdBy: adminId,
      geoCoordinates: { lat: 26.8667, lng: 75.7667 }
    },
    { 
      name: 'Retro Corner', city: 'Jodhpur', address: 'Sardarpura, Main Market', 
      pincode: '342003', state: 'Rajasthan', country: 'India', 
      maxCapacity: 80, status: 'active', createdBy: adminId,
      geoCoordinates: { lat: 26.2389, lng: 73.0243 }
    }
  ];
  return await Location.insertMany(locations);
};

const seedCategories = async (adminId) => {
  console.log('🍽️  Seeding Culinary Sectors...');
  const categories = [
    { name: 'Coffee', description: 'Artisanal specialty brews', createdBy: adminId },
    { name: 'Tea', description: 'Heritage infusions and chai', createdBy: adminId },
    { name: 'Pizza', description: 'Hand-tossed wood-fired creations', createdBy: adminId },
    { name: 'Burgers', description: 'Gourmet stack constructs', createdBy: adminId },
    { name: 'Desserts', description: 'Premium sweet sequence nodes', createdBy: adminId },
    { name: 'Snacks', description: 'Rapid operational nutrition', createdBy: adminId },
    { name: 'Beverages', description: 'Climate-controlled liquid assets', createdBy: adminId }
  ];
  return await Category.insertMany(categories);
};

const seedMenuItems = async (categories, adminId, locations) => {
  console.log('🍕 Seeding Menu Matrix...');
  const menuItems = [];
  const templates = {
    'Coffee': ['Cappuccino', 'Latte', 'Espresso', 'Mocha', 'Americano', 'Flat White', 'Cortado'],
    'Tea': ['Masala Chai', 'Green Tea', 'Earl Grey', 'Hibiscus', 'Oolong', 'Matcha', 'Chamomile'],
    'Pizza': ['Margherita', 'Pepperoni', 'Garden Fresh', 'BBQ Chicken', 'Four Cheese', 'Spicy Paneer'],
    'Burgers': ['Classic Veg', 'Double Cheese', 'Spicy Zinger', 'Mushroom Melt', 'Crispy Chicken', 'Lamb Burger'],
    'Desserts': ['Tiramisu', 'Chocolate Lava', 'Cheesecake', 'Apple Crumble', 'Ice Cream', 'Red Velvet'],
    'Snacks': ['French Fries', 'Nachos', 'Spring Rolls', 'Potato Wedges', 'Garlic Bread', 'Onion Rings'],
    'Beverages': ['Cold Coffee', 'Iced Tea', 'Lemonade', 'Fruit Punch', 'Virgin Mojito', 'Blue Lagoon']
  };

  for (const cat of categories) {
    const items = templates[cat.name] || [];
    for (const name of items) {
      const originalPrice = faker.number.int({ min: 200, max: 800 });
      const price = Math.floor(originalPrice * 0.9); // 10% discount default
      const costPrice = Math.floor(price * 0.45);
      
      const item = {
        name, 
        category: cat._id, 
        price, 
        originalPrice,
        discountedPrice: price,
        costPrice,
        preparationTime: faker.number.int({ min: 5, max: 25 }),
        description: faker.commerce.productDescription(), 
        isAvailable: true, 
        createdBy: adminId,
        image: `https://loremflickr.com/320/240/${name.toLowerCase().replace(' ', '')}`,
        locationId: faker.helpers.arrayElement([null, locations[0]._id, locations[1]._id]) // Some global, some local
      };
      menuItems.push(item);
    }
  }
  return await MenuItem.insertMany(menuItems);
};

const seedTables = async (locations, adminId) => {
  console.log('🪑 Seeding Operational Terminals...');
  const tables = [];
  for (const loc of locations) {
    for (let i = 1; i <= 12; i++) {
      tables.push({
        tableNumber: i, 
        tableName: i <= 4 ? `Premium Booth ${i}` : `Standard Table ${i}`,
        locationId: loc._id, 
        capacity: faker.helpers.arrayElement([2, 4, 6, 8]),
        status: 'available', 
        isBooked: false,
        createdBy: adminId
      });
    }
  }
  return await Table.insertMany(tables);
};

const seedOrders = async (locations, users, menuItems, tables) => {
  console.log('📦 Seeding OMS Order Lifecycle...');
  const orders = [];
  const statuses = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED', 'REJECTED'];

  for (let i = 0; i < 150; i++) {
    const loc = faker.helpers.arrayElement(locations);
    const branchUsers = users.filter(u => u.assignedLocation?.toString() === loc._id.toString());
    const chefs = branchUsers.filter(u => u.role === 'chef');
    const staff = branchUsers.filter(u => u.role === 'staff');
    const branchTables = tables.filter(t => t.locationId.toString() === loc._id.toString());
    const table = faker.helpers.arrayElement(branchTables);

    const orderItems = [];
    const numItems = faker.number.int({ min: 1, max: 5 });
    let totalAmount = 0;
    for (let j = 0; j < numItems; j++) {
      const item = faker.helpers.arrayElement(menuItems);
      const qty = faker.number.int({ min: 1, max: 3 });
      orderItems.push({ menuItem: item._id, quantity: qty, notes: j === 0 ? 'Extra spicy' : '' });
      totalAmount += (item.price * qty);
    }

    const status = faker.helpers.arrayElement(statuses);
    const createdAt = faker.date.recent({ days: 60 });

    orders.push({
      branch: loc._id, 
      table: table._id, 
      createdBy: staff[0]?._id || users[0]._id,
      assignedChef: ['ACCEPTED', 'PREPARING', 'READY', 'SERVED'].includes(status) ? faker.helpers.arrayElement(chefs)?._id : undefined,
      items: orderItems, 
      status, 
      totalAmount,
      chefNote: status === 'PREPARING' ? 'Processing hand-tossed dough...' : '',
      rejectReason: status === 'REJECTED' ? 'Ingredient chain disruption' : '',
      createdAt, 
      updatedAt: new Date(createdAt.getTime() + 30 * 60000),
      statusHistory: [
        { status: 'PLACED', timestamp: createdAt },
        ...(status !== 'PLACED' ? [{ status: status, timestamp: new Date(createdAt.getTime() + 15 * 60000) }] : [])
      ]
    });

    if (['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].includes(status)) {
      await Table.findByIdAndUpdate(table._id, { status: 'ongoing', isBooked: true });
    }
  }
  return await Order.insertMany(orders);
};

const seedReservations = async (locations, users, adminId) => {
  console.log('📅 Seeding Reservation Matrix...');
  const reservations = [];
  const eventTypes = ['Birthday Party', 'Corporate Lunch', 'Family Dinner', 'Casual Hangout', 'Anniversary', 'Date Night'];
  const staff = users.filter(u => u.role === 'staff');

  for (let i = 0; i < 40; i++) {
    const loc = faker.helpers.arrayElement(locations);
    const table = await Table.findOne({ locationId: loc._id });
    reservations.push({
      eventName: faker.helpers.arrayElement(eventTypes),
      reservationType: 'table',
      userId: staff[0]?._id || adminId,
      locationId: loc._id,
      tableIds: table ? [table._id] : [],
      customerName: faker.person.fullName(),
      customerPhone: faker.string.numeric(10),
      numberOfGuests: faker.number.int({ min: 2, max: 12 }),
      date: faker.date.between({ from: '2026-04-01', to: '2026-06-30' }).toISOString().split('T')[0],
      startTime: '19:00',
      endTime: '21:30',
      status: faker.helpers.arrayElement(['confirmed', 'pending', 'cancelled']),
      totalAmount: faker.number.int({ min: 500, max: 5000 }),
      createdBy: adminId
    });
  }
  return await Reservation.insertMany(reservations);
};

const seedAttendance = async (users, adminId) => {
  console.log('🕒 Seeding Temporal Presence Logs...');
  const attendance = [];
  const activeStaff = users.filter(u => ['staff', 'chef', 'branch_admin'].includes(u.role));
  
  for (const u of activeStaff) {
    if (!u.assignedLocation) continue;
    for (let i = 0; i < 45; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      attendance.push({
        user: u._id, 
        locationId: u.assignedLocation, 
        date: dateStr,
        status: faker.helpers.arrayElement(['present', 'present', 'present', 'present', 'absent', 'half-day']),
        markedBy: adminId
      });
    }
  }
  return await Attendance.insertMany(attendance);
};

const seedExpenses = async (locations, adminId) => {
  console.log('💸 Seeding Expenditure Yields...');
  const expenses = [];
  const cats = ['utilities', 'ingredients', 'maintenance', 'marketing', 'other'];
  for (let i = 0; i < 80; i++) {
    const loc = faker.helpers.arrayElement(locations);
    const amount = faker.number.int({ min: 1000, max: 15000 });
    expenses.push({
      locationId: loc._id,
      title: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      amount,
      profit: -amount,
      type: 'expense',
      date: faker.date.recent({ days: 60 }),
      createdBy: adminId,
      proofImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg'
    });
  }
  return await Expense.insertMany(expenses);
};

const seedTransactions = async (orders, expenses, menuItems, adminId, tables) => {
  console.log('💳 Seeding Financial Stream...');
  const txs = [];

  // 1. Create Revenue Transactions from SERVED orders
  for (const o of orders) {
    if (o.status === 'SERVED') {
      const branchTable = tables.find(t => t._id.toString() === o.table.toString());
      
      let totalCost = 0;
      const txOrders = o.items.map(item => {
        const mItem = menuItems.find(mi => mi._id.toString() === item.menuItem.toString());
        const cost = (mItem?.costPrice || 0) * item.quantity;
        totalCost += cost;
        return {
          menuItemId: item.menuItem,
          itemName: mItem?.name || 'Unknown Item',
          quantity: item.quantity,
          price: mItem?.price || 0,
          costPrice: mItem?.costPrice || 0
        };
      });

      txs.push({
        locationId: o.branch,
        type: 'pos_revenue',
        tableNumber: branchTable?.tableNumber || 1,
        staffId: o.createdBy,
        createdBy: adminId,
        orders: txOrders,
        totalAmount: o.totalAmount,
        totalProfit: o.totalAmount - totalCost,
        date: o.createdAt,
        billImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg'
      });
    }
  }

  // 2. Create Expense Transactions from expenses
  const expenseCats = ['Utilities', 'Ingredients', 'Maintenance', 'Rent', 'Salaries', 'Supplies'];
  for (const e of expenses) {
    txs.push({
      locationId: e.locationId,
      type: 'expense',
      title: e.title,
      category: faker.helpers.arrayElement(expenseCats),
      createdBy: adminId,
      totalAmount: e.amount,
      totalProfit: -e.amount,
      date: e.date,
      description: e.description,
      billImage: e.proofImage
    });
  }

  return await Transaction.insertMany(txs);
};

const seedCoupons = async (adminId) => {
  console.log('🎟️  Seeding Promotion Protocols...');
  const coupons = [];
  for (let i = 1; i <= 15; i++) {
    coupons.push({
      code: `CAFE${i * 10}`,
      discountType: i % 3 === 0 ? 'fixed' : 'percentage',
      discountValue: i % 3 === 0 ? 200 : 15,
      minOrderAmount: 1000,
      expiryDate: new Date('2026-12-31'),
      usageLimit: 200,
      createdBy: adminId,
      isActive: true
    });
  }
  return await Coupon.insertMany(coupons);
};

const seedRecipes = async (menuItems, adminId) => {
  console.log('📖 Seeding Culinary Protocols...');
  const recipes = [];
  for (const item of menuItems) {
    const recipe = {
      menuItemId: item._id,
      ingredients: [
        { name: 'Primary Ingredient', quantity: 200, unit: 'grams' },
        { name: 'Flavor Catalyst', quantity: 15, unit: 'ml' },
        { name: 'Garnish Module', quantity: 1, unit: 'pcs' }
      ],
      instructions: [
        { step: 1, text: 'Initialize primary ingredient preparation' },
        { step: 2, text: 'Integrate flavor catalyst under high thermal conditions' },
        { step: 3, text: 'Finalize assembly with garnish module' }
      ],
      notes: 'Maintain standard protocol for optimal yield',
      createdBy: adminId
    };
    recipes.push(recipe);
  }
  const createdRecipes = await Recipe.insertMany(recipes);
  
  // Update MenuItems with recipeId
  for (const recipe of createdRecipes) {
    await MenuItem.findByIdAndUpdate(recipe.menuItemId, { recipeId: recipe._id });
  }
  
  return createdRecipes;
};

const seedNotifications = async (adminId, users) => {
  console.log('🔔 Seeding Intelligence Notifications...');
  const notifications = [];
  for (let i = 0; i < 20; i++) {
    notifications.push({
      title: faker.hacker.ingverb() + ' Update',
      message: faker.hacker.phrase(),
      type: faker.helpers.arrayElement(['user_action', 'expense', 'table_action']),
      roleTarget: ['branch_admin', 'admin'],
      createdBy: adminId
    });
  }
  return await Notification.insertMany(notifications);
};

const executeSeeding = async () => {
  const conn = await connectDB();
  await resetDB();

  try {
    const hashedPassword = SEED_PASSWORD; // User model hashes this in pre-save
    
    // 1. Create Super Admin
    console.log('👤 Seeding Super Admin...');
    const superAdmin = new User({
      name: 'Super Admin',
      email: 'super@cafeos.com',
      password: hashedPassword,
      role: 'super_admin',
      phone: '9999999999',
      gender: 'Male',
      age: 32,
      address1: 'Central Headquarters, Sector Alpha',
      city: 'Jaipur',
      state: 'Rajasthan',
      country: 'India',
      aadharNumber: '111122223333',
      aadharImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg',
      highestQualification: 'Post Graduate',
      profileImageUrl: 'https://i.pravatar.cc/150?u=super'
    });
    await superAdmin.save();
    const superAdminId = superAdmin._id;

    // 2. Seed Locations
    const locations = await seedLocations(superAdminId);

    // 3. Seed Personnel Hierarchy
    console.log('👥 Seeding Personnel Hierarchy...');
    const users = [];

    // Global Admins
    for (let i = 1; i <= 3; i++) {
      users.push({
        name: `Senior Admin ${i}`,
        email: `admin${i}@cafeos.com`,
        password: hashedPassword,
        role: 'admin',
        phone: `987654321${i}`,
        gender: i % 2 === 0 ? 'Female' : 'Male',
        age: 38,
        address1: 'Corporate Sector, Hub ' + i,
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        aadharNumber: `44445555666${i}`,
        aadharImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg',
        highestQualification: 'Post Graduate',
        accessibleLocations: locations.map(l => l._id),
        profileImageUrl: `https://i.pravatar.cc/150?u=admin${i}`
      });
    }

    // Branch Operations (Per Location)
    for (const loc of locations) {
      // Branch Admin (Local Manager)
      users.push({
        name: `Manager ${loc.name}`,
        email: `manager.${loc.name.toLowerCase().replace(' ', '')}@cafeos.com`,
        password: hashedPassword,
        role: 'branch_admin',
        phone: faker.string.numeric(10),
        gender: faker.helpers.arrayElement(['Male', 'Female']),
        age: 29,
        address1: faker.location.streetAddress(),
        city: loc.city,
        state: loc.state,
        country: loc.country,
        aadharNumber: faker.string.numeric(12),
        aadharImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg',
        highestQualification: 'Graduate',
        assignedLocation: loc._id,
        monthlySalary: 55000,
        profileImageUrl: `https://i.pravatar.cc/150?u=mgr${loc._id}`
      });

      // Chefs
      for (let i = 1; i <= 3; i++) {
        users.push({
          name: `Head Chef ${i} ${loc.name}`,
          email: `chef${i}.${loc.name.toLowerCase().replace(' ', '')}@cafeos.com`,
          password: hashedPassword,
          role: 'chef',
          phone: faker.string.numeric(10),
          gender: faker.helpers.arrayElement(['Male', 'Female']),
          age: 34,
          address1: faker.location.streetAddress(),
          city: loc.city,
          state: loc.state,
          country: loc.country,
          aadharNumber: faker.string.numeric(12),
          aadharImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg',
          highestQualification: 'Diploma',
          assignedLocation: loc._id,
          monthlySalary: 42000,
          profileImageUrl: `https://i.pravatar.cc/150?u=chef${loc._id}${i}`
        });
      }

      // Operational Staff
      for (let i = 1; i <= 6; i++) {
        users.push({
          name: `Staff Node ${i} ${loc.name}`,
          email: `staff${i}.${loc.name.toLowerCase().replace(' ', '')}@cafeos.com`,
          password: hashedPassword,
          role: 'staff',
          phone: faker.string.numeric(10),
          gender: faker.helpers.arrayElement(['Male', 'Female']),
          age: 23,
          address1: faker.location.streetAddress(),
          city: loc.city,
          state: loc.state,
          country: loc.country,
          aadharNumber: faker.string.numeric(12),
          aadharImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg',
          highestQualification: 'Graduate',
          assignedLocation: loc._id,
          monthlySalary: 28000,
          profileImageUrl: `https://i.pravatar.cc/150?u=staff${loc._id}${i}`
        });
      }
    }

    const seededUsers = [];
    for (const userData of users) {
      const u = new User(userData);
      await u.save();
      seededUsers.push(u);
    }
    const allUsers = [superAdmin, ...seededUsers];

    // 4. Seeding Operational Context
    const categories = await seedCategories(superAdminId);
    const menuItems = await seedMenuItems(categories, superAdminId, locations);
    await seedRecipes(menuItems, superAdminId);
    const tables = await seedTables(locations, superAdminId);
    const orders = await seedOrders(locations, allUsers, menuItems, tables);
    await seedReservations(locations, allUsers, superAdminId);
    await seedAttendance(allUsers, superAdminId);
    const expenses = await seedExpenses(locations, superAdminId);
    await seedTransactions(orders, expenses, menuItems, superAdminId, tables);
    await seedCoupons(superAdminId);
    await seedNotifications(superAdminId, allUsers);

    console.log('\n✔ All Strategic Nodes Initialized Successfully');
    console.log('📡 Ecosystem ready for production simulation 🚀');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Strategic Seeding Failure: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
};

executeSeeding();

