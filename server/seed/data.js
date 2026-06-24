const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');

// Load env vars
dotenv.config();

// Models
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

const seedData = async () => {
  try {
    await connectDB();
    console.log('Connecting to database...');

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

    console.log('Seeding Super Admin...');
    const superAdminData = {
      name: 'Super Admin', email: 'super@cafeos.com', password: 'password123', phone: '9999999990', gender: 'Male',
      age: 30, address1: 'HQ', city: 'Mumbai', state: 'MH', country: 'India', role: 'super_admin', aadharNumber: '111122223333',
      aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate', permissions: { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true }
    };
    const superAdmin = await User.create(superAdminData);

    const adminData = {
      name: 'Admin User', email: 'admin@cafeos.com', password: 'password123', phone: '9999999991', gender: 'Female',
      age: 28, address1: 'HQ', city: 'Mumbai', state: 'MH', country: 'India', role: 'admin', aadharNumber: '111122223334',
      aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate', permissions: { viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true, forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true, viewAnalytics: true, manageCoupons: true }
    };
    const admin = await User.create(adminData);

    console.log('Seeding Demo Cafe...');
    const demoCafe = await Cafe.create({
      name: 'CafeOS Demo',
      gstin: 'GSTIN1234567890',
      address: { line1: 'HQ Complex', city: 'Mumbai', state: 'MH', pincode: '400001', country: 'India' },
      contact: { phone: '9999999990', email: 'hello@cafeos.com' },
      status: 'active',
      createdBy: superAdmin._id,
    });

    console.log('Seeding Locations...');
    const locationData = [
      { name: 'Downtown Cafe', city: 'Mumbai', state: 'MH', country: 'India', pincode: '400001', geoCoordinates: { lat: 18.9220, lng: 72.8347 }, status: 'active', cafe: demoCafe._id, createdBy: superAdmin._id },
      { name: 'Uptown Bistro', city: 'Delhi', state: 'DL', country: 'India', pincode: '110001', geoCoordinates: { lat: 28.6139, lng: 77.2090 }, status: 'active', cafe: demoCafe._id, createdBy: superAdmin._id },
      { name: 'Airport Lounge', city: 'Bangalore', state: 'KA', country: 'India', pincode: '560001', geoCoordinates: { lat: 12.9716, lng: 77.5946 }, status: 'active', cafe: demoCafe._id, createdBy: superAdmin._id },
    ];
    const locations = await Location.insertMany(locationData);

    // Update Admins with accessible locations and cafe membership
    await User.findByIdAndUpdate(superAdmin._id, { accessibleLocations: locations.map(l => l._id), cafes: [demoCafe._id] });
    await User.findByIdAndUpdate(admin._id, {
      accessibleLocations: locations.map(l => l._id),
      cafes: [demoCafe._id],
    });

    console.log('Seeding Branch Staff...');
    const branchUsersData = locations.flatMap((loc, i) => [
      {
        name: `Branch Admin ${i+1}`, email: `branch${i+1}@cafeos.com`, password: 'password123', phone: `999999991${i}`, gender: 'Male',
        age: 35, address1: 'Branch', city: loc.city, state: loc.state, country: 'India', pincode: loc.pincode, role: 'branch_admin', assignedLocation: loc._id,
        aadharNumber: `11112222334${i}`, aadharImage: 'http://example.com/aadhar', highestQualification: 'Graduate',
        permissions: { viewOrders: true, manageOrders: true, manageStaff: true, viewAnalytics: true }
      },
      {
        name: `Chef ${i+1}`, email: `chef${i+1}@cafeos.com`, password: 'password123', phone: `999999992${i}`, gender: 'Male',
        age: 40, address1: 'Branch', city: loc.city, state: loc.state, country: 'India', pincode: loc.pincode, role: 'chef', assignedLocation: loc._id,
        aadharNumber: `11112222335${i}`, aadharImage: 'http://example.com/aadhar', highestQualification: 'Diploma', monthlySalary: 50000
      },
      {
        name: `Staff ${i+1}`, email: `staff${i+1}@cafeos.com`, password: 'password123', phone: `999999993${i}`, gender: 'Female',
        age: 25, address1: 'Branch', city: loc.city, state: loc.state, country: 'India', pincode: loc.pincode, role: 'staff', assignedLocation: loc._id,
        aadharNumber: `11112222336${i}`, aadharImage: 'http://example.com/aadhar', highestQualification: '12th Pass', monthlySalary: 25000
      }
    ]);
    const users = await User.create(branchUsersData);
    const branchAdmins = users.filter(u => u.role === 'branch_admin');
    const chefs = users.filter(u => u.role === 'chef');
    const staffs = users.filter(u => u.role === 'staff');

    console.log('Seeding Categories & MenuItems...');
    const catData = [
      { name: 'Hot Beverages', description: 'Coffee and Tea', type: 'BEVERAGE', createdBy: superAdmin._id },
      { name: 'Cold Beverages', description: 'Iced Coffee and Shakes', type: 'BEVERAGE', createdBy: superAdmin._id },
      { name: 'Pastries', description: 'Sweet treats', type: 'FOOD', createdBy: superAdmin._id },
      { name: 'Main Course', description: 'Heavy meals', type: 'FOOD', createdBy: superAdmin._id }
    ];
    const categories = await Category.insertMany(catData);

    const menuData = [];
    const baseItems = [
      { name: 'Espresso', price: 150, prepTime: 5, catName: 'Hot Beverages', cost: 50, dietaryType: 'veg' },
      { name: 'Cappuccino', price: 200, prepTime: 8, catName: 'Hot Beverages', cost: 70, dietaryType: 'veg' },
      { name: 'Iced Latte', price: 220, prepTime: 6, catName: 'Cold Beverages', cost: 80, dietaryType: 'veg' },
      { name: 'Mango Shake', price: 250, prepTime: 10, catName: 'Cold Beverages', cost: 100, dietaryType: 'veg' },
      { name: 'Croissant', price: 120, prepTime: 2, catName: 'Pastries', cost: 40, dietaryType: 'non-veg' },
      { name: 'Chocolate Muffin', price: 100, prepTime: 2, catName: 'Pastries', cost: 30, dietaryType: 'non-veg' },
      { name: 'Pasta Alfredo', price: 350, prepTime: 20, catName: 'Main Course', cost: 150, dietaryType: 'veg' },
      { name: 'Margherita Pizza', price: 400, prepTime: 25, catName: 'Main Course', cost: 180, dietaryType: 'veg' },
    ];
    
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

    console.log('Seeding Inventory...');
    const ingData = [
      { name: 'Coffee Beans', unit: 'kg', category: 'General', minThreshold: 5 },
      { name: 'Milk', unit: 'L', category: 'General', minThreshold: 20 },
      { name: 'Sugar', unit: 'kg', category: 'General', minThreshold: 10 },
      { name: 'Flour', unit: 'kg', category: 'General', minThreshold: 15 },
      { name: 'Cheese', unit: 'kg', category: 'General', minThreshold: 5 },
    ];
    const ingredients = await Ingredient.insertMany(ingData);

    const branchInventoryData = [];
    const branchStockData = [];
    locations.forEach(loc => {
      ingredients.forEach(ing => {
        const invId = new mongoose.Types.ObjectId();
        branchInventoryData.push({
          _id: invId,
          branch: loc._id,
          ingredient: ing._id,
          stock: Math.floor(Math.random() * 50) + 10,
          costPerUnit: Math.floor(Math.random() * 100) + 50,
          minThreshold: ing.minThreshold
        });
      });
      const locMenu = menuItems.filter(m => m.locationId && m.locationId.toString() === loc._id.toString());
      locMenu.forEach(item => {
        branchStockData.push({
          menuItem: item._id,
          branch: loc._id,
          stock: Math.floor(Math.random() * 50) + 10,
          isAvailable: true
        });
      });
    });
    await BranchInventory.insertMany(branchInventoryData);
    await BranchStock.insertMany(branchStockData);

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

    console.log('Seeding Orders & Transactions...');
    const orderData = [];
    const transactionData = [];
    const now = new Date();
    
    // Generate ~1000 orders across the last 30 days
    for (let i = 0; i < 1000; i++) {
      const loc = locations[Math.floor(Math.random() * locations.length)];
      const locTables = tables.filter(t => t.locationId.toString() === loc._id.toString());
      const table = locTables[Math.floor(Math.random() * locTables.length)];
      const staff = staffs.find(s => s.assignedLocation?.toString() === loc._id.toString());
      const chef = chefs.find(c => c.assignedLocation?.toString() === loc._id.toString());
      const locMenu = menuItems.filter(m => m.locationId && m.locationId.toString() === loc._id.toString());
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

      // Random date within last 30 days
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
        status: status,
        isBilled: isCompleted,
        totalAmount: totalAmt,
        paymentType: ['CASH', 'UPI', 'CARD'][Math.floor(Math.random() * 3)],
        createdAt: pastDate,
        completedAt: isCompleted ? new Date(pastDate.getTime() + 30 * 60000) : null,
      });

      if (isCompleted) {
        transactionData.push({
          locationId: loc._id,
          orderId: orderId,
          totalAmount: totalAmt,
          totalProfit: totalAmt - totalCost,
          type: 'REVENUE',
          source: 'ORDER',
          title: `Order Payment for ${cust.name}`,
          status: 'approved',
          category: 'Food Sales',
          date: pastDate,
          createdBy: superAdmin._id
        });
      }
    }
    await Order.insertMany(orderData);
    await Transaction.insertMany(transactionData);

    console.log('Seeding Expenses (via Transaction model)...');
    const transactionExpenseData = [];
    const expenseCategories = ['Inventory', 'Electricity', 'Water', 'Maintenance', 'Marketing', 'Rent'];
    locations.forEach(loc => {
      for (let i = 0; i < 60; i++) {
        const pastDate = new Date(now.getTime() - i * 12 * 60 * 60 * 1000);
        const amount = Math.floor(Math.random() * 5000) + 1000;
        transactionExpenseData.push({
          locationId: loc._id,
          type: 'EXPENSE',
          source: 'MANUAL',
          title: `${expenseCategories[i % expenseCategories.length]} Payment`,
          description: `Routine monthly/daily ${expenseCategories[i % expenseCategories.length].toLowerCase()} expense`,
          totalAmount: amount,
          totalProfit: -amount, // Expenses reduce profit
          category: expenseCategories[i % expenseCategories.length],
          status: 'approved',
          date: pastDate,
          billImage: 'http://example.com/receipt.jpg',
          createdBy: branchAdmins.find(b => b.assignedLocation?.toString() === loc._id.toString())?._id || superAdmin._id,
        });
      }
    });
    await Transaction.insertMany(transactionExpenseData);

    console.log('Seeding detailed Expense records...');
    const expenseData = transactionExpenseData.map(t => ({
      locationId: t.locationId,
      title: t.title,
      description: t.description,
      amount: t.totalAmount,
      category: t.category,
      status: 'approved',
      type: 'expense',
      date: t.date,
      proofImage: t.billImage,
      createdBy: t.createdBy,
    }));
    await Expense.insertMany(expenseData);

    console.log('Seeding Attendance...');
    const attendanceData = [];
    const staffMembers = [...branchAdmins, ...chefs, ...staffs];
    staffMembers.forEach(staff => {
      for (let i = 0; i < 30; i++) {
        if (Math.random() > 0.2) { // 80% present
          attendanceData.push({
            user: staff._id,
            locationId: staff.assignedLocation,
            date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: Math.random() > 0.1 ? 'present' : 'half-day',
            punchIn: new Date(),
            punchOut: new Date(),
            markedBy: superAdmin._id
          });
        } else {
          attendanceData.push({
            user: staff._id,
            locationId: staff.assignedLocation,
            date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'absent',
            markedBy: superAdmin._id
          });
        }
      }
    });
    await Attendance.insertMany(attendanceData);

    console.log('Seeding Coupons & Notifications...');
    const couponData = [
      { code: 'WELCOME50', discountType: 'percentage', discountValue: 50, maxDiscount: 100, minOrderAmount: 200, expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), usageLimit: 100, isActive: true, createdBy: superAdmin._id },
      { code: 'FLAT100', discountType: 'fixed', discountValue: 100, minOrderAmount: 500, expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), usageLimit: 50, isActive: true, createdBy: superAdmin._id }
    ];
    await Coupon.insertMany(couponData);

    const notifData = [];
    staffMembers.forEach(staff => {
      notifData.push({
        sender: superAdmin._id,
        title: 'Welcome to CafeOS',
        message: 'Your account has been successfully provisioned.',
        type: 'announcement',
        recipients: [{ user: staff._id, isRead: false }]
      });
    });
    await Notification.insertMany(notifData);

    console.log('Massive Database Seeding Completed Successfully! 🎉');
    process.exit(0);
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
};

seedData();
