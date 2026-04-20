require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { branches, users, menuItems, categories } = require('./data');

// Models
const User = require('../models/User');
const Branch = require('../models/Branch');
const Expense = require('../models/Expense');
const Table = require('../models/Table');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB for seeding...');

    if (process.argv[2] === '--clear') {
      console.log('Clearing existing data...');
      await User.deleteMany({});
      await Branch.deleteMany({});
      await Expense.deleteMany({});
      await Table.deleteMany({});
      await Attendance.deleteMany({});
      await Notification.deleteMany({});
      console.log('✅ Collections cleared');
    }

    // 1. Seed Users (need Super Admin/Admin first for createdBy)
    console.log('Seeding Users...');
    const hashedUsers = await Promise.all(users.map(async (u) => {
      const salt = await bcrypt.genSalt(10);
      u.password = await bcrypt.hash(u.password, salt);
      u.aadharImage = 'https://res.cloudinary.com/demo/image/upload/v1624104111/sample.jpg';
      return u;
    }));
    
    const createdUsers = await User.insertMany(hashedUsers);
    const superAdmin = createdUsers.find(u => u.role === 'super_admin');
    console.log('✅ Users Seeded');

    // 2. Seed Branches
    console.log('Seeding Branches...');
    const branchesWithAdmin = branches.map(b => ({
      ...b,
      createdBy: superAdmin._id
    }));
    const createdBranches = await Branch.insertMany(branchesWithAdmin);
    console.log('✅ Branches Seeded');

    // 3. Seed Expenses
    console.log('Seeding Expenses...');
    const expenseData = [];
    for (let i = 0; i < 20; i++) {
      const branch = createdBranches[i % 2]; // Downtown or Uptown
      const date = new Date();
      date.setDate(date.getDate() - (i % 30));
      
      expenseData.push({
        title: `Monthly ${categories[i % categories.length]}`,
        description: `Regular monthly expense for ${categories[i % categories.length]}`,
        amount: Math.floor(Math.random() * 5000) + 1000,
        category: categories[i % categories.length],
        date,
        branchName: branch.name,
        createdBy: superAdmin._id,
        proofImage: 'https://res.cloudinary.com/demo/image/upload/v1624104111/sample.jpg'
      });
    }
    await Expense.insertMany(expenseData);
    console.log('✅ Expenses Seeded');

    // 4. Seed Tables & Orders
    console.log('Seeding Tables...');
    const activeBranches = createdBranches.filter(b => b.status === 'active');
    for (const branch of activeBranches) {
      for (let i = 1; i <= 8; i++) {
        const isBooked = i % 3 === 0;
        const isCompleted = i % 4 === 0;
        
        let orders = [];
        let totalAmount = 0;
        let numberOfPeople = 0;

        if (isBooked || isCompleted) {
          numberOfPeople = Math.floor(Math.random() * 4) + 1;
          const orderCount = Math.floor(Math.random() * 3) + 1;
          for (let j = 0; j < orderCount; j++) {
            const item = menuItems[Math.floor(Math.random() * menuItems.length)];
            const quantity = Math.floor(Math.random() * 2) + 1;
            orders.push({ ...item, quantity });
            totalAmount += item.price * quantity;
          }
        }

        await Table.create({
          tableNumber: i,
          branchName: branch.name,
          status: isCompleted ? 'completed' : (isBooked ? 'booked' : 'available'),
          numberOfPeople,
          orders,
          totalAmount,
          createdBy: superAdmin._id,
          billImage: isCompleted ? 'https://res.cloudinary.com/demo/image/upload/v1624104111/sample.jpg' : null
        });
      }
    }
    console.log('✅ Tables Seeded');

    // 5. Seed Attendance (Last 30 days for staff)
    console.log('Seeding Attendance (this might take a moment)...');
    const staffMembers = createdUsers.filter(u => u.role === 'staff');
    const attendanceData = [];
    
    for (const staff of staffMembers) {
      const branchAdmin = createdUsers.find(u => u.role === 'branch_admin' && u.branchName === staff.branchName);
      for (let d = 0; d < 30; d++) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const dateString = date.toISOString().split('T')[0];

        attendanceData.push({
          user: staff._id,
          branchName: staff.branchName,
          date: dateString,
          status: Math.random() > 0.2 ? 'present' : 'absent',
          markedBy: branchAdmin ? branchAdmin._id : superAdmin._id
        });
      }
    }
    await Attendance.insertMany(attendanceData);
    console.log('✅ Attendance Seeded');

    // 6. Seed Notifications
    console.log('Seeding Notifications...');
    const notificationData = [];
    for (let i = 0; i < 15; i++) {
      notificationData.push({
        title: 'System Alert',
        message: `Sample notification message ${i + 1}`,
        type: i % 2 === 0 ? 'expense' : 'user_action',
        createdBy: superAdmin._id,
        recipients: [{ user: superAdmin._id, isRead: i % 3 === 0 }],
        roleTarget: ['super_admin', 'admin']
      });
    }
    await Notification.insertMany(notificationData);
    console.log('✅ Notifications Seeded');

    console.log('🚀 DATABASE READY FOR TESTING');
    process.exit();
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

seedDB();
