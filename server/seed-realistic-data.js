const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');
const Location = require('./models/Location');
const Order = require('./models/Order');
const Transaction = require('./models/Transaction');
const Expense = require('./models/Expense');
const Reservation = require('./models/Reservation');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/cafe-system';

const getRandomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomAmount = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const expenseCategories = ['groceries', 'maintenance', 'gas', 'electricity', 'salary advance', 'kitchen tools', 'packaging', 'rent', 'internet', 'misc'];
const expenseStatuses = ['pending', 'approved', 'rejected', 'live', 'completed'];

const seedData = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB Connected for Seeding');

    const locations = await Location.find();
    if (locations.length === 0) {
      console.log('No locations found. Exiting.');
      process.exit();
    }

    const allUsers = await User.find();
    const superAdmins = allUsers.filter(u => u.role === 'super_admin');
    const admins = allUsers.filter(u => u.role === 'admin');
    const branchAdmins = allUsers.filter(u => u.role === 'branch_admin' || u.role === 'location_admin');
    const chefs = allUsers.filter(u => u.role === 'chef');
    const staffs = allUsers.filter(u => u.role === 'staff');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12); // Past 12 months

    console.log('Generating Realistic Expenses...');
    const expenseRecords = [];
    for (let i = 0; i < 200; i++) {
      const loc = getRandomElement(locations);
      const creatorArray = [
        ...superAdmins, ...admins, 
        ...(branchAdmins.filter(ba => ba.assignedLocation?.toString() === loc._id.toString())),
        ...(chefs.filter(c => c.assignedLocation?.toString() === loc._id.toString())),
        ...(staffs.filter(s => s.assignedLocation?.toString() === loc._id.toString()))
      ];
      
      const creator = getRandomElement(creatorArray) || getRandomElement(superAdmins) || getRandomElement(allUsers);
      
      expenseRecords.push({
        title: `Seeded Expense ${i}`,
        description: 'Auto-generated expense for testing pagination and filters',
        amount: getRandomAmount(50, 5000),
        category: getRandomElement(expenseCategories),
        status: getRandomElement(expenseStatuses),
        date: getRandomDate(startDate, endDate),
        locationId: loc._id,
        createdBy: creator._id,
        type: 'expense',
        proofImage: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'
      });
    }
    await Expense.insertMany(expenseRecords);

    console.log('Generating Realistic Revenue (Transactions)...');
    const transactionRecords = [];
    for (let i = 0; i < 400; i++) {
      const loc = getRandomElement(locations);
      const creatorArray = [
        ...(branchAdmins.filter(ba => ba.assignedLocation?.toString() === loc._id.toString())),
        ...(staffs.filter(s => s.assignedLocation?.toString() === loc._id.toString()))
      ];
      const creator = getRandomElement(creatorArray) || getRandomElement(allUsers);
      const amount = getRandomAmount(150, 2000);

      transactionRecords.push({
        locationId: loc._id,
        type: 'REVENUE',
        source: getRandomElement(['ORDER', 'POS']),
        title: `Seeded Invoice ${Math.floor(Math.random() * 10000)}`,
        category: 'Food',
        customerName: `Customer ${Math.floor(Math.random() * 1000)}`,
        createdBy: creator._id,
        totalAmount: amount,
        totalProfit: amount * 0.4,
        date: getRandomDate(startDate, endDate),
        status: 'approved',
      });
    }
    await Transaction.insertMany(transactionRecords);

    console.log('Generating Realistic Reservations...');
    const reservationRecords = [];
    for (let i = 0; i < 150; i++) {
      const loc = getRandomElement(locations);
      const creatorArray = [
        ...(staffs.filter(s => s.assignedLocation?.toString() === loc._id.toString()))
      ];
      const creator = getRandomElement(creatorArray) || getRandomElement(allUsers);
      
      reservationRecords.push({
        eventName: `Birthday/Anniversary ${i}`,
        reservationType: 'table',
        userId: creator._id,
        locationId: loc._id,
        tableIds: [], // Empty for simplicity unless we fetch tables
        date: getRandomDate(startDate, endDate),
        startTime: '19:00',
        endTime: '21:00',
        customerName: `Reserver ${i}`,
        customerPhone: `99999${Math.floor(10000 + Math.random() * 90000)}`,
        totalAmount: getRandomAmount(1000, 5000),
        status: getRandomElement(['pending', 'confirmed', 'cancelled'])
      });
    }
    await Reservation.insertMany(reservationRecords);

    console.log('Seeding Complete!');
    process.exit();
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
};

seedData();
