const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');

dotenv.config();

const Location = require('../models/Location');
const User = require('../models/User');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');
const Recipe = require('../models/Recipe');
const Table = require('../models/Table');
const Customer = require('../models/Customer');
const Reservation = require('../models/Reservation');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const WasteRecord = require('../models/WasteRecord');
const BranchInventory = require('../models/BranchInventory');
const BranchStock = require('../models/BranchStock');
const Cafe = require('../models/Cafe');

// Exported so startupMigrations can call it on a fresh (empty) database.
const seedData = async () => {
  console.log('Dropping existing data...');
  const models = [
    Cafe, Location, User, Category, MenuItem, Ingredient, Recipe, Table, Customer,
    Reservation, Order, Transaction, Expense, Payroll, Attendance, Coupon,
    Notification, AuditLog, WasteRecord, BranchInventory, BranchStock
  ];
  for (const model of models) {
    await model.deleteMany({});
  }
  console.log('Data dropped.');

  // ------------------------------------------------------------------ Users
  console.log('Seeding Super Admin...');
  const superAdmin = await User.create({
    name: 'Super', email: 'super@cafeos.com', password: 'password123',
    phone: '9999999990', gender: 'Male', age: 30,
    address1: 'HQ', city: 'Mumbai', state: 'MH', country: 'India',
    role: 'super_admin', aadharNumber: '111122223333',
    aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true }
  });

  // Two admin accounts matching QuickLogin
  const rajesh = await User.create({
    name: 'Rajesh', email: 'rajesh.admin@cafeos.com', password: 'password123',
    phone: '9999999991', gender: 'Male', age: 34,
    address1: 'HQ', city: 'Mumbai', state: 'MH', country: 'India',
    role: 'admin', aadharNumber: '111122223334',
    aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true }
  });
  const meera = await User.create({
    name: 'Meera', email: 'meera.admin@cafeos.com', password: 'password123',
    phone: '9999999992', gender: 'Female', age: 31,
    address1: 'HQ', city: 'Delhi', state: 'DL', country: 'India',
    role: 'admin', aadharNumber: '111122223335',
    aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true }
  });

  // ------------------------------------------------------------------ Cafe
  console.log('Seeding Demo Cafe...');
  const demoCafe = await Cafe.create({
    name: 'CafeOS Demo',
    gstin: 'GSTIN1234567890',
    address: { line1: 'HQ Complex', city: 'Mumbai', state: 'MH', pincode: '400001', country: 'India' },
    contact: { phone: '9999999990', email: 'hello@cafeos.com' },
    status: 'active',
    createdBy: superAdmin._id,
  });

  // ------------------------------------------------------------------ Locations (branches)
  console.log('Seeding Locations...');
  const locationData = [
    { name: 'Downtown Cafe',  city: 'Mumbai',    state: 'MH', country: 'India', pincode: '400001', geoCoordinates: { lat: 18.9220, lng: 72.8347 }, status: 'active', cafe: demoCafe._id, createdBy: superAdmin._id },
    { name: 'Uptown Bistro',  city: 'Delhi',     state: 'DL', country: 'India', pincode: '110001', geoCoordinates: { lat: 28.6139, lng: 77.2090 }, status: 'active', cafe: demoCafe._id, createdBy: superAdmin._id },
    { name: 'Airport Lounge', city: 'Bangalore', state: 'KA', country: 'India', pincode: '560001', geoCoordinates: { lat: 12.9716, lng: 77.5946 }, status: 'active', cafe: demoCafe._id, createdBy: superAdmin._id },
  ];
  const locations = await Location.insertMany(locationData);
  const [loc0, loc1, loc2] = locations; // Downtown, Uptown, Airport

  // Link super_admin and both admins to all branches + cafe
  await User.findByIdAndUpdate(superAdmin._id, { accessibleLocations: locations.map(l => l._id), cafes: [demoCafe._id] });
  await User.findByIdAndUpdate(rajesh._id,     { accessibleLocations: locations.map(l => l._id), cafes: [demoCafe._id] });
  await User.findByIdAndUpdate(meera._id,      { accessibleLocations: locations.map(l => l._id), cafes: [demoCafe._id] });

  // ------------------------------------------------------------------ Branch staff (matching QuickLogin exactly)
  console.log('Seeding Branch Staff...');
  const PERMS_BA = { viewOrders: true, manageOrders: true, manageStaff: true, viewAnalytics: true };

  // Branch Admins
  const arjun = await User.create({
    name: 'Arjun', email: 'arjun.ba1@cafeos.com', password: 'password123',
    phone: '9888000001', gender: 'Male', age: 29,
    address1: 'Branch', city: loc0.city, state: loc0.state, country: 'India', pincode: loc0.pincode,
    role: 'branch_admin', assignedLocation: loc0._id,
    aadharNumber: '222233334441', aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: PERMS_BA, accessibleLocations: [loc0._id]
  });
  const kavya = await User.create({
    name: 'Kavya', email: 'kavya.ba1@cafeos.com', password: 'password123',
    phone: '9888000002', gender: 'Female', age: 27,
    address1: 'Branch', city: loc0.city, state: loc0.state, country: 'India', pincode: loc0.pincode,
    role: 'branch_admin', assignedLocation: loc0._id,
    aadharNumber: '222233334442', aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: PERMS_BA, accessibleLocations: [loc0._id]
  });
  // Rohan manages all three branches
  const rohan = await User.create({
    name: 'Rohan', email: 'rohan.multi@cafeos.com', password: 'password123',
    phone: '9888000003', gender: 'Male', age: 33,
    address1: 'HQ', city: 'Mumbai', state: 'MH', country: 'India', pincode: '400001',
    role: 'branch_admin', assignedLocation: loc0._id,
    aadharNumber: '222233334443', aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: PERMS_BA, accessibleLocations: [loc0._id, loc1._id, loc2._id]
  });
  const aditya = await User.create({
    name: 'Aditya', email: 'aditya.ba2@cafeos.com', password: 'password123',
    phone: '9888000004', gender: 'Male', age: 31,
    address1: 'Branch', city: loc1.city, state: loc1.state, country: 'India', pincode: loc1.pincode,
    role: 'branch_admin', assignedLocation: loc1._id,
    aadharNumber: '222233334444', aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: PERMS_BA, accessibleLocations: [loc1._id]
  });
  const karthik = await User.create({
    name: 'Karthik', email: 'karthik.ba3@cafeos.com', password: 'password123',
    phone: '9888000005', gender: 'Male', age: 28,
    address1: 'Branch', city: loc2.city, state: loc2.state, country: 'India', pincode: loc2.pincode,
    role: 'branch_admin', assignedLocation: loc2._id,
    aadharNumber: '222233334445', aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: PERMS_BA, accessibleLocations: [loc2._id]
  });

  // Location Admins
  const sneha = await User.create({
    name: 'Sneha', email: 'sneha.la1@cafeos.com', password: 'password123',
    phone: '9888000011', gender: 'Female', age: 26,
    address1: 'Branch', city: loc0.city, state: loc0.state, country: 'India', pincode: loc0.pincode,
    role: 'location_admin', assignedLocation: loc0._id,
    aadharNumber: '333344445551', aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: { viewOrders: true, manageOrders: true, viewAnalytics: true }, accessibleLocations: [loc0._id]
  });
  const nikhil = await User.create({
    name: 'Nikhil', email: 'nikhil.la2@cafeos.com', password: 'password123',
    phone: '9888000012', gender: 'Male', age: 30,
    address1: 'Branch', city: loc1.city, state: loc1.state, country: 'India', pincode: loc1.pincode,
    role: 'location_admin', assignedLocation: loc1._id,
    aadharNumber: '333344445552', aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: { viewOrders: true, manageOrders: true, viewAnalytics: true }, accessibleLocations: [loc1._id]
  });
  const divya = await User.create({
    name: 'Divya', email: 'divya.la3@cafeos.com', password: 'password123',
    phone: '9888000013', gender: 'Female', age: 25,
    address1: 'Branch', city: loc2.city, state: loc2.state, country: 'India', pincode: loc2.pincode,
    role: 'location_admin', assignedLocation: loc2._id,
    aadharNumber: '333344445553', aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
    permissions: { viewOrders: true, manageOrders: true, viewAnalytics: true }, accessibleLocations: [loc2._id]
  });

  // Chefs
  const ramesh = await User.create({
    name: 'Ramesh', email: 'ramesh.chef1@cafeos.com', password: 'password123',
    phone: '9888000021', gender: 'Male', age: 38,
    address1: 'Branch', city: loc0.city, state: loc0.state, country: 'India', pincode: loc0.pincode,
    role: 'chef', assignedLocation: loc0._id,
    aadharNumber: '444455556661', aadharImage: 'http://example.com/aadhar', highestQualification: 'Diploma', monthlySalary: 50000
  });
  const suresh = await User.create({
    name: 'Suresh', email: 'suresh.chef2@cafeos.com', password: 'password123',
    phone: '9888000022', gender: 'Male', age: 42,
    address1: 'Branch', city: loc1.city, state: loc1.state, country: 'India', pincode: loc1.pincode,
    role: 'chef', assignedLocation: loc1._id,
    aadharNumber: '444455556662', aadharImage: 'http://example.com/aadhar', highestQualification: 'Diploma', monthlySalary: 55000
  });
  const mahesh = await User.create({
    name: 'Mahesh', email: 'mahesh.chef3@cafeos.com', password: 'password123',
    phone: '9888000023', gender: 'Male', age: 36,
    address1: 'Branch', city: loc2.city, state: loc2.state, country: 'India', pincode: loc2.pincode,
    role: 'chef', assignedLocation: loc2._id,
    aadharNumber: '444455556663', aadharImage: 'http://example.com/aadhar', highestQualification: 'Diploma', monthlySalary: 52000
  });

  // Staff
  const priya = await User.create({
    name: 'Priya', email: 'priya.staff1@cafeos.com', password: 'password123',
    phone: '9888000031', gender: 'Female', age: 22,
    address1: 'Branch', city: loc0.city, state: loc0.state, country: 'India', pincode: loc0.pincode,
    role: 'staff', assignedLocation: loc0._id,
    aadharNumber: '555566667771', aadharImage: 'http://example.com/aadhar', highestQualification: '12th Pass', monthlySalary: 25000
  });
  const anjali = await User.create({
    name: 'Anjali', email: 'anjali.staff2@cafeos.com', password: 'password123',
    phone: '9888000032', gender: 'Female', age: 24,
    address1: 'Branch', city: loc1.city, state: loc1.state, country: 'India', pincode: loc1.pincode,
    role: 'staff', assignedLocation: loc1._id,
    aadharNumber: '555566667772', aadharImage: 'http://example.com/aadhar', highestQualification: '12th Pass', monthlySalary: 25000
  });
  const deepak = await User.create({
    name: 'Deepak', email: 'deepak.staff3@cafeos.com', password: 'password123',
    phone: '9888000033', gender: 'Male', age: 23,
    address1: 'Branch', city: loc2.city, state: loc2.state, country: 'India', pincode: loc2.pincode,
    role: 'staff', assignedLocation: loc2._id,
    aadharNumber: '555566667773', aadharImage: 'http://example.com/aadhar', highestQualification: '12th Pass', monthlySalary: 26000
  });

  const branchAdmins = [arjun, kavya, rohan, aditya, karthik];
  const chefs = [ramesh, suresh, mahesh];
  const staffs = [priya, anjali, deepak];

  // ------------------------------------------------------------------ Categories & Menu
  console.log('Seeding Categories & MenuItems...');
  const catData = [
    { name: 'Hot Beverages', description: 'Coffee and Tea', type: 'BEVERAGE', createdBy: superAdmin._id },
    { name: 'Cold Beverages', description: 'Iced Coffee and Shakes', type: 'BEVERAGE', createdBy: superAdmin._id },
    { name: 'Pastries', description: 'Sweet treats', type: 'FOOD', createdBy: superAdmin._id },
    { name: 'Main Course', description: 'Heavy meals', type: 'FOOD', createdBy: superAdmin._id }
  ];
  const categories = await Category.insertMany(catData);

  const baseItems = [
    { name: 'Espresso',         price: 150, prepTime: 5,  catName: 'Hot Beverages',  cost: 50,  dietaryType: 'veg' },
    { name: 'Cappuccino',       price: 200, prepTime: 8,  catName: 'Hot Beverages',  cost: 70,  dietaryType: 'veg' },
    { name: 'Iced Latte',       price: 220, prepTime: 6,  catName: 'Cold Beverages', cost: 80,  dietaryType: 'veg' },
    { name: 'Mango Shake',      price: 250, prepTime: 10, catName: 'Cold Beverages', cost: 100, dietaryType: 'veg' },
    { name: 'Croissant',        price: 120, prepTime: 2,  catName: 'Pastries',       cost: 40,  dietaryType: 'non-veg' },
    { name: 'Chocolate Muffin', price: 100, prepTime: 2,  catName: 'Pastries',       cost: 30,  dietaryType: 'non-veg' },
    { name: 'Pasta Alfredo',    price: 350, prepTime: 20, catName: 'Main Course',    cost: 150, dietaryType: 'veg' },
    { name: 'Margherita Pizza', price: 400, prepTime: 25, catName: 'Main Course',    cost: 180, dietaryType: 'veg' },
  ];

  const menuData = [];
  locations.forEach(loc => {
    baseItems.forEach(item => {
      const cat = categories.find(c => c.name === item.catName);
      menuData.push({
        locationId: loc._id,
        availableBranches: [loc._id],
        category: cat._id,
        name: item.name,
        description: `Delicious ${item.name}`,
        price: item.price,
        preparationTime: item.prepTime,
        isAvailable: true,
        costPrice: item.cost,
        dietaryType: item.dietaryType,
        createdBy: superAdmin._id
      });
    });
  });
  const menuItems = await MenuItem.insertMany(menuData);

  // ------------------------------------------------------------------ Inventory
  console.log('Seeding Inventory...');
  const ingData = [
    { name: 'Coffee Beans', unit: 'kg', category: 'General', minThreshold: 5 },
    { name: 'Milk',         unit: 'L',  category: 'General', minThreshold: 20 },
    { name: 'Sugar',        unit: 'kg', category: 'General', minThreshold: 10 },
    { name: 'Flour',        unit: 'kg', category: 'General', minThreshold: 15 },
    { name: 'Cheese',       unit: 'kg', category: 'General', minThreshold: 5 },
  ];
  const ingredients = await Ingredient.insertMany(ingData);

  const branchInventoryData = [];
  const branchStockData = [];
  locations.forEach(loc => {
    ingredients.forEach(ing => {
      branchInventoryData.push({
        branch: loc._id,
        ingredient: ing._id,
        stock: Math.floor(Math.random() * 50) + 10,
        costPerUnit: Math.floor(Math.random() * 100) + 50,
        minThreshold: ing.minThreshold
      });
    });
    const locMenu = menuItems.filter(m => m.locationId && m.locationId.toString() === loc._id.toString());
    locMenu.forEach(item => {
      branchStockData.push({ menuItem: item._id, branch: loc._id, stock: Math.floor(Math.random() * 50) + 10, isAvailable: true });
    });
  });
  await BranchInventory.insertMany(branchInventoryData);
  await BranchStock.insertMany(branchStockData);

  // ------------------------------------------------------------------ Customers & Tables
  console.log('Seeding Customers & Tables...');
  const customerData = Array.from({ length: 50 }).map((_, i) => ({
    name: `Customer ${i}`,
    phone: `88888888${i.toString().padStart(2, '0')}`,
    email: `customer${i}@example.com`,
    loyaltyPoints: Math.floor(Math.random() * 1000),
    totalSpend: Math.floor(Math.random() * 10000),
    visits: Math.floor(Math.random() * 20) + 1,
    lastVisit: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    branch: locations[Math.floor(Math.random() * locations.length)]._id
  }));
  const customers = await Customer.insertMany(customerData);

  const tableData = [];
  locations.forEach(loc => {
    for (let i = 1; i <= 15; i++) {
      tableData.push({
        locationId: loc._id,
        tableNumber: i,
        capacity: i % 2 === 0 ? 4 : 2,
        status: Math.random() > 0.8 ? 'booked' : 'available',
        createdBy: superAdmin._id
      });
    }
  });
  const tables = await Table.insertMany(tableData);

  // ------------------------------------------------------------------ Orders & Transactions
  console.log('Seeding Orders & Transactions...');
  const orderData = [];
  const transactionData = [];
  const now = new Date();

  const chefByLoc = {
    [loc0._id.toString()]: ramesh,
    [loc1._id.toString()]: suresh,
    [loc2._id.toString()]: mahesh,
  };
  const staffByLoc = {
    [loc0._id.toString()]: priya,
    [loc1._id.toString()]: anjali,
    [loc2._id.toString()]: deepak,
  };

  for (let i = 0; i < 1000; i++) {
    const loc = locations[Math.floor(Math.random() * locations.length)];
    const locKey = loc._id.toString();
    const locTables = tables.filter(t => t.locationId.toString() === locKey);
    const table = locTables[Math.floor(Math.random() * locTables.length)];
    const chef = chefByLoc[locKey];
    const staff = staffByLoc[locKey];
    const locMenu = menuItems.filter(m => m.locationId && m.locationId.toString() === locKey);
    const cust = customers[Math.floor(Math.random() * customers.length)];

    const orderItems = [];
    let totalAmt = 0;
    let totalCost = 0;
    const numItems = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < numItems; j++) {
      const item = locMenu[Math.floor(Math.random() * locMenu.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      orderItems.push({ menuItem: item._id, quantity: qty });
      totalAmt += item.price * qty;
      totalCost += item.costPrice * qty;
    }

    const gst = Math.round(totalAmt * 0.05);
    const grandTotal = totalAmt + gst;
    const pastDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const isCompleted = Math.random() > 0.1;
    const status = isCompleted ? 'COMPLETED' : 'PLACED';
    const orderId = new mongoose.Types.ObjectId();

    orderData.push({
      _id: orderId,
      branch: loc._id,
      table: table._id,
      customerPhone: cust.phone,
      customerName: cust.name,
      createdBy: staff ? staff._id : superAdmin._id,
      assignedChef: chef ? chef._id : null,
      servedBy: staff ? staff._id : null,
      items: orderItems,
      status,
      isBilled: isCompleted,
      totalAmount: totalAmt,
      grandTotal,
      paymentType: ['CASH', 'UPI', 'CARD'][Math.floor(Math.random() * 3)],
      createdAt: pastDate,
      completedAt: isCompleted ? new Date(pastDate.getTime() + 30 * 60000) : null,
    });

    if (isCompleted) {
      transactionData.push({
        locationId: loc._id,
        orderId,
        totalAmount: grandTotal,
        totalProfit: grandTotal - totalCost,
        type: 'REVENUE',
        source: 'ORDER',
        title: `Order Payment – ${cust.name}`,
        status: 'approved',
        category: 'Food Sales',
        date: pastDate,
        createdBy: superAdmin._id
      });
    }
  }
  await Order.insertMany(orderData);
  await Transaction.insertMany(transactionData);

  // ------------------------------------------------------------------ Expenses
  console.log('Seeding Expenses...');
  const expenseCategories = ['Inventory', 'Electricity', 'Water', 'Maintenance', 'Marketing', 'Rent'];
  const transactionExpenseData = [];
  locations.forEach(loc => {
    const ba = branchAdmins.find(b => b.assignedLocation?.toString() === loc._id.toString()) || superAdmin;
    for (let i = 0; i < 60; i++) {
      const pastDate = new Date(now.getTime() - i * 12 * 60 * 60 * 1000);
      const amount = Math.floor(Math.random() * 5000) + 1000;
      const cat = expenseCategories[i % expenseCategories.length];
      transactionExpenseData.push({
        locationId: loc._id,
        type: 'EXPENSE',
        source: 'MANUAL',
        title: `${cat} Payment`,
        description: `Routine ${cat.toLowerCase()} expense`,
        totalAmount: amount,
        totalProfit: -amount,
        category: cat,
        status: 'approved',
        date: pastDate,
        billImage: 'http://example.com/receipt.jpg',
        createdBy: ba._id,
      });
    }
  });
  await Transaction.insertMany(transactionExpenseData);

  const expenseData = transactionExpenseData.map(t => ({
    locationId: t.locationId,
    title: t.title,
    description: t.description,
    amount: t.totalAmount,
    category: t.category,
    status: 'approved',
    type: 'EXPENSE',
    date: t.date,
    proofImage: t.billImage,
    createdBy: t.createdBy,
  }));
  await Expense.insertMany(expenseData);

  // ------------------------------------------------------------------ Attendance
  console.log('Seeding Attendance...');
  const staffMembers = [...branchAdmins, ...chefs, ...staffs];
  const attendanceData = [];
  staffMembers.forEach(s => {
    for (let i = 0; i < 30; i++) {
      attendanceData.push({
        user: s._id,
        locationId: s.assignedLocation,
        date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: Math.random() > 0.2 ? (Math.random() > 0.1 ? 'present' : 'half-day') : 'absent',
        punchIn: new Date(),
        punchOut: new Date(),
        markedBy: superAdmin._id
      });
    }
  });
  await Attendance.insertMany(attendanceData);

  // ------------------------------------------------------------------ Payroll
  // Daily-rate model with a multi-stage approval workflow. Each (user, month) is
  // unique. The current month is still pending; older months are approved/paid.
  console.log('Seeding Payroll...');
  const payrollData = [];
  staffMembers.forEach(s => {
    if (!s.monthlySalary) return;
    for (let m = 0; m < 3; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dailyRate = Math.round(s.monthlySalary / 30);
      const payableDays = 30 - (m % 3); // 30, 29, 28
      const baseSalary = dailyRate * payableDays;
      const penalties = { lateMark: (m % 2) * 100, absent: 0, leave: 0 };
      const bonuses = { topSeller: m === 0 ? 1000 : 0, performance: 500, extraShifts: 0 };
      const penaltyTotal = penalties.lateMark + penalties.absent + penalties.leave;
      const bonusTotal = bonuses.topSeller + bonuses.performance + bonuses.extraShifts;
      const status = ['PENDING_BRANCH_APPROVAL', 'FINAL_APPROVED', 'PAID'][m] || 'PAID';
      const approved = status !== 'PENDING_BRANCH_APPROVAL';
      payrollData.push({
        user: s._id,
        month,
        dailyRate,
        payableDays,
        baseSalary,
        penalties,
        bonuses,
        netSalary: baseSalary - penaltyTotal + bonusTotal,
        status,
        approvedByBranchAt: approved ? new Date(d.getFullYear(), d.getMonth(), 28) : undefined,
        approvedByAdminAt: approved ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : undefined,
        approvedBySuperAdminAt: status === 'PAID' ? new Date(d.getFullYear(), d.getMonth() + 1, 2) : undefined,
      });
    }
  });
  if (payrollData.length) await Payroll.insertMany(payrollData);

  // ------------------------------------------------------------------ Coupons & Notifications
  console.log('Seeding Coupons & Notifications...');
  await Coupon.insertMany([
    { code: 'WELCOME50', discountType: 'percentage', discountValue: 50, maxDiscount: 100, minOrderAmount: 200, expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), usageLimit: 100, isActive: true, createdBy: superAdmin._id },
    { code: 'FLAT100',   discountType: 'fixed',      discountValue: 100,                  minOrderAmount: 500, expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), usageLimit: 50,  isActive: true, createdBy: superAdmin._id }
  ]);

  const notifData = [];
  staffMembers.forEach(s => {
    notifData.push({
      sender: superAdmin._id,
      title: 'Welcome to CafeOS',
      message: 'Your account has been successfully provisioned.',
      type: 'announcement',
      recipients: [{ user: s._id, isRead: false }]
    });
  });
  await Notification.insertMany(notifData);

  console.log('Seeding complete! All demo accounts use password: password123');
};

module.exports = { seedData };

// Run directly: node server/seed/data.js
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedData();
      process.exit(0);
    } catch (error) {
      console.error('Seeding Error:', error);
      process.exit(1);
    }
  })();
}
