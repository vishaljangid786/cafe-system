/**
 * CafeOS — Comprehensive Demo Seed
 * --------------------------------
 * Seeds a fully-related dataset covering every model, every relationship and
 * every meaningful field. Users match the QuickLogin roster exactly
 * (client/app/login/QuickLogin.js) — all accounts share password "password123".
 *
 *   Cafe (1 brand)  ->  3 Branches (Mumbai / Delhi / Bangalore)
 *   per branch: branch_admin(s), location_admin, chef, staff, menu, recipes,
 *   inventory, tables, orders, transactions, expenses, attendance, payroll,
 *   leave, reservations, bookings, waitlist, feedback, gift cards, cash sessions,
 *   suppliers, purchase orders, waste records, notifications, audit logs.
 *
 * Run:  npm run seed         (seed)
 *       npm run seed:clear   (wipe only)
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');

dotenv.config();

const Cafe = require('../models/Cafe');
const Location = require('../models/Location');
const User = require('../models/User');
const Settings = require('../models/Settings');
const PermissionPreset = require('../models/PermissionPreset');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');
const Recipe = require('../models/Recipe');
const Table = require('../models/Table');
const Customer = require('../models/Customer');
const Reservation = require('../models/Reservation');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Coupon = require('../models/Coupon');
const GiftCard = require('../models/GiftCard');
const Feedback = require('../models/Feedback');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const CashSession = require('../models/CashSession');
const WasteRecord = require('../models/WasteRecord');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const BranchInventory = require('../models/BranchInventory');
const BranchStock = require('../models/BranchStock');

// ---------------------------------------------------------------------------
// Deterministic helpers (no Math.random for reproducible relations where it
// matters; light randomness elsewhere for realistic spread).
// ---------------------------------------------------------------------------
const PASSWORD = 'password123';
const PROOF = 'https://res.cloudinary.com/demo/image/upload/v1/cafeos/receipt.jpg';
const AADHAR_BASE = 100000000000;
let aadharSeq = 0;
const nextAadhar = () => String(AADHAR_BASE + aadharSeq++); // always 12 digits
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;
const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
const ymd = (date) => date.toISOString().split('T')[0];
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const ALL_COLLECTIONS = [
  Cafe, Location, User, Settings, PermissionPreset, Category, MenuItem, Ingredient,
  Recipe, Table, Customer, Reservation, Booking, Waitlist, Order, Transaction, Expense,
  Payroll, Attendance, LeaveRequest, Coupon, GiftCard, Feedback, Supplier, PurchaseOrder,
  CashSession, WasteRecord, Notification, AuditLog, BranchInventory, BranchStock,
];

const clearAll = async () => {
  console.log('🧹 Clearing all collections...');
  for (const model of ALL_COLLECTIONS) await model.deleteMany({});
  // Clear the startup-migration lock so a future server boot re-evaluates cleanly.
  try { await mongoose.connection.db.collection('migrations').deleteMany({}); } catch (_) {}
  console.log('   done.');
};

const seed = async () => {
  // ----- Cafe (brand) -----
  console.log('🏢 Cafe...');
  // Super admin is created first so createdBy refs resolve.
  const superAdmin = await User.create({
    name: 'Super Admin', email: 'super@cafeos.com', password: PASSWORD, phone: '9000000001',
    gender: 'Male', age: 35, address1: 'CafeOS HQ, Tower A', address2: 'BKC',
    city: 'Mumbai', state: 'Maharashtra', country: 'India', pincode: '400051',
    alternatePhone: '9000000099', role: 'super_admin', aadharNumber: nextAadhar(),
    aadharImage: PROOF, highestQualification: 'Post Graduate', monthlySalary: 0,
    profileImageUrl: '', permissions: {
      viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
      forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true,
      viewAnalytics: true, manageCoupons: true, manageBranches: true, viewAuditLogs: true,
      impersonateUsers: true, viewAdminCenter: true, manageGlobalMenu: true,
      sendGlobalNotifications: true, sendMessages: true, messageSuperAdmin: true,
    },
  });

  const cafe = await Cafe.create({
    name: 'CafeOS Central', logo: '', gstin: '27AABCU9603R1ZM',
    address: { line1: 'CafeOS HQ, Tower A', line2: 'BKC', city: 'Mumbai', state: 'Maharashtra', country: 'India', pincode: '400051' },
    contact: { phone: '9000000001', email: 'hello@cafeos.com' },
    status: 'active', createdBy: superAdmin._id,
  });

  // ----- Locations (branches) -----
  console.log('📍 Branches...');
  const locations = await Location.insertMany([
    { cafe: cafe._id, name: 'Downtown Cafe', city: 'Mumbai', state: 'Maharashtra', country: 'India', pincode: '400001', geoCoordinates: { lat: 18.922, lng: 72.8347 }, status: 'active', maxCapacity: 60, dietaryType: 'both', createdBy: superAdmin._id },
    { cafe: cafe._id, name: 'Uptown Bistro', city: 'Delhi', state: 'Delhi', country: 'India', pincode: '110001', geoCoordinates: { lat: 28.6139, lng: 77.209 }, status: 'active', maxCapacity: 45, dietaryType: 'both', createdBy: superAdmin._id },
    { cafe: cafe._id, name: 'Airport Lounge', city: 'Bangalore', state: 'Karnataka', country: 'India', pincode: '560001', geoCoordinates: { lat: 12.9716, lng: 77.5946 }, status: 'active', maxCapacity: 30, dietaryType: 'both', createdBy: superAdmin._id },
  ]);
  const [loc1, loc2, loc3] = locations;
  const allLocIds = locations.map((l) => l._id);
  const svcRateByLoc = { [loc1._id]: 5, [loc2._id]: 0, [loc3._id]: 10 }; // % service charge

  // ----- Users (exact QuickLogin roster) -----
  console.log('👤 Users (QuickLogin roster)...');
  await User.findByIdAndUpdate(superAdmin._id, { accessibleLocations: allLocIds, cafes: [cafe._id] });

  const fullPerms = {
    viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
    forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true,
    viewAnalytics: true, manageCoupons: true, manageBranches: true, viewAuditLogs: true,
    impersonateUsers: true, viewAdminCenter: true, manageGlobalMenu: true,
    sendGlobalNotifications: true, sendMessages: true, messageSuperAdmin: true,
  };
  const baAdminPerms = {
    viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
    forceComplete: true, exportReports: true, manageStaff: true, manageNotifications: true,
    viewAnalytics: true, manageCoupons: true, sendMessages: true, messageSuperAdmin: true,
  };
  const laPerms = { viewRevenue: true, viewOrders: true, manageOrders: true, manageStaff: true, viewAnalytics: true, sendMessages: true };
  const staffPerms = { viewOrders: true, manageOrders: true, sendMessages: true };
  const chefPerms = { viewOrders: true, manageOrders: true, sendMessages: true };

  const mk = (o) => ({ password: PASSWORD, country: 'India', aadharNumber: nextAadhar(), aadharImage: PROOF, profileImageUrl: '', ...o });

  const admins = await User.create([
    mk({ name: 'Rajesh', email: 'rajesh.admin@cafeos.com', phone: '9000000010', gender: 'Male', age: 42, address1: 'Admin Residency 1', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', role: 'admin', highestQualification: 'Post Graduate', monthlySalary: 120000, accessibleLocations: allLocIds, cafes: [cafe._id], permissions: fullPerms }),
    mk({ name: 'Meera', email: 'meera.admin@cafeos.com', phone: '9000000011', gender: 'Female', age: 38, address1: 'Admin Residency 2', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', role: 'admin', highestQualification: 'Graduate', monthlySalary: 110000, accessibleLocations: allLocIds, cafes: [cafe._id], permissions: fullPerms }),
  ]);

  const branchAdmins = await User.create([
    mk({ name: 'Arjun', email: 'arjun.ba1@cafeos.com', phone: '9000000020', gender: 'Male', age: 34, address1: 'Branch Qtrs 1', city: loc1.city, state: loc1.state, pincode: loc1.pincode, role: 'branch_admin', assignedLocation: loc1._id, accessibleLocations: [loc1._id], highestQualification: 'Graduate', monthlySalary: 70000, permissions: baAdminPerms }),
    mk({ name: 'Kavya', email: 'kavya.ba1@cafeos.com', phone: '9000000021', gender: 'Female', age: 31, address1: 'Branch Qtrs 1', city: loc1.city, state: loc1.state, pincode: loc1.pincode, role: 'branch_admin', assignedLocation: loc1._id, accessibleLocations: [loc1._id], highestQualification: 'Graduate', monthlySalary: 68000, permissions: baAdminPerms }),
    mk({ name: 'Rohan', email: 'rohan.multi@cafeos.com', phone: '9000000022', gender: 'Male', age: 45, address1: 'Branch Qtrs Multi', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', role: 'branch_admin', assignedLocation: loc1._id, accessibleLocations: allLocIds, highestQualification: 'Post Graduate', monthlySalary: 90000, permissions: baAdminPerms }),
    mk({ name: 'Aditya', email: 'aditya.ba2@cafeos.com', phone: '9000000023', gender: 'Male', age: 36, address1: 'Branch Qtrs 2', city: loc2.city, state: loc2.state, pincode: loc2.pincode, role: 'branch_admin', assignedLocation: loc2._id, accessibleLocations: [loc2._id], highestQualification: 'Graduate', monthlySalary: 70000, permissions: baAdminPerms }),
    mk({ name: 'Karthik', email: 'karthik.ba3@cafeos.com', phone: '9000000024', gender: 'Male', age: 39, address1: 'Branch Qtrs 3', city: loc3.city, state: loc3.state, pincode: loc3.pincode, role: 'branch_admin', assignedLocation: loc3._id, accessibleLocations: [loc3._id], highestQualification: 'Graduate', monthlySalary: 72000, permissions: baAdminPerms }),
  ]);

  const locationAdmins = await User.create([
    mk({ name: 'Sneha', email: 'sneha.la1@cafeos.com', phone: '9000000030', gender: 'Female', age: 29, address1: 'Loc Admin 1', city: loc1.city, state: loc1.state, pincode: loc1.pincode, role: 'location_admin', assignedLocation: loc1._id, accessibleLocations: [loc1._id], highestQualification: 'Graduate', monthlySalary: 55000, permissions: laPerms }),
    mk({ name: 'Nikhil', email: 'nikhil.la2@cafeos.com', phone: '9000000031', gender: 'Male', age: 33, address1: 'Loc Admin 2', city: loc2.city, state: loc2.state, pincode: loc2.pincode, role: 'location_admin', assignedLocation: loc2._id, accessibleLocations: [loc2._id], highestQualification: 'Graduate', monthlySalary: 56000, permissions: laPerms }),
    mk({ name: 'Divya', email: 'divya.la3@cafeos.com', phone: '9000000032', gender: 'Female', age: 30, address1: 'Loc Admin 3', city: loc3.city, state: loc3.state, pincode: loc3.pincode, role: 'location_admin', assignedLocation: loc3._id, accessibleLocations: [loc3._id], highestQualification: 'Graduate', monthlySalary: 54000, permissions: laPerms }),
  ]);

  const chefs = await User.create([
    mk({ name: 'Ramesh', email: 'ramesh.chef1@cafeos.com', phone: '9000000040', gender: 'Male', age: 41, address1: 'Chef Lane 1', city: loc1.city, state: loc1.state, pincode: loc1.pincode, role: 'chef', assignedLocation: loc1._id, highestQualification: 'Diploma', monthlySalary: 48000, permissions: chefPerms }),
    mk({ name: 'Suresh', email: 'suresh.chef2@cafeos.com', phone: '9000000041', gender: 'Male', age: 44, address1: 'Chef Lane 2', city: loc2.city, state: loc2.state, pincode: loc2.pincode, role: 'chef', assignedLocation: loc2._id, highestQualification: 'Diploma', monthlySalary: 49000, permissions: chefPerms }),
    mk({ name: 'Mahesh', email: 'mahesh.chef3@cafeos.com', phone: '9000000042', gender: 'Male', age: 38, address1: 'Chef Lane 3', city: loc3.city, state: loc3.state, pincode: loc3.pincode, role: 'chef', assignedLocation: loc3._id, highestQualification: 'Diploma', monthlySalary: 47000, permissions: chefPerms }),
  ]);

  const staff = await User.create([
    mk({ name: 'Priya', email: 'priya.staff1@cafeos.com', phone: '9000000050', gender: 'Female', age: 24, address1: 'Staff Hostel 1', city: loc1.city, state: loc1.state, pincode: loc1.pincode, role: 'staff', assignedLocation: loc1._id, highestQualification: '12th Pass', monthlySalary: 28000, permissions: staffPerms }),
    mk({ name: 'Anjali', email: 'anjali.staff2@cafeos.com', phone: '9000000051', gender: 'Female', age: 26, address1: 'Staff Hostel 2', city: loc2.city, state: loc2.state, pincode: loc2.pincode, role: 'staff', assignedLocation: loc2._id, highestQualification: '12th Pass', monthlySalary: 27000, permissions: staffPerms }),
    mk({ name: 'Deepak', email: 'deepak.staff3@cafeos.com', phone: '9000000052', gender: 'Male', age: 23, address1: 'Staff Hostel 3', city: loc3.city, state: loc3.state, pincode: loc3.pincode, role: 'staff', assignedLocation: loc3._id, highestQualification: '10th Pass', monthlySalary: 26000, permissions: staffPerms }),
  ]);

  // Per-branch helpers
  const employeesByLoc = (locId) => [...branchAdmins, ...locationAdmins, ...chefs, ...staff]
    .filter((u) => (u.accessibleLocations || []).some((l) => l.toString() === locId.toString()) || (u.assignedLocation && u.assignedLocation.toString() === locId.toString()));
  const staffByLoc = (locId) => staff.find((s) => s.assignedLocation.toString() === locId.toString());
  const chefByLoc = (locId) => chefs.find((c) => c.assignedLocation.toString() === locId.toString());

  // ----- Settings (global + per branch) -----
  console.log('⚙️  Settings...');
  await Settings.create({ locationId: null }); // global defaults
  for (const loc of locations) {
    await Settings.create({
      locationId: loc._id,
      tax: { gstRate: 5, gstin: cafe.gstin },
      billing: { serviceChargeRate: svcRateByLoc[loc._id], roundBill: true },
      loyalty: { pointsPer100: 1, rewardThresholdPoints: 100, rewardCouponValue: 100, rewardMinOrder: 300, rewardExpiryDays: 30, tierSilver: 5000, tierGold: 20000, tierPlatinum: 50000 },
      invoice: { prefix: `INV-${loc.city.slice(0, 3).toUpperCase()}`, nextNumber: 1 },
      payroll: { shiftStart: '09:00', graceMinutes: 10, standardDayMinutes: 480, overtimeMultiplier: 1.5, latePenaltyGroup: 3, latePenaltyDayUnit: 0.5, halfDayThresholdMinutes: 240 },
      general: { currency: 'INR', timezone: 'Asia/Kolkata' },
    });
  }

  // ----- Permission Presets -----
  console.log('🪪 Permission presets...');
  await PermissionPreset.create([
    { name: 'Shift Manager', createdBy: superAdmin._id, createdByName: superAdmin.name, permissions: { viewOrders: true, manageOrders: true, forceComplete: true, manageStaff: true, viewRevenue: true, viewAnalytics: true } },
    { name: 'Cashier', createdBy: superAdmin._id, createdByName: superAdmin.name, permissions: { viewOrders: true, manageOrders: true } },
    { name: 'Auditor', createdBy: superAdmin._id, createdByName: superAdmin.name, permissions: { viewRevenue: true, viewAnalytics: true, viewAuditLogs: true, exportReports: true } },
  ]);

  // ----- Categories (globally unique) & Ingredients -----
  console.log('🍽️  Categories, ingredients, menu, recipes...');
  const categories = await Category.insertMany([
    { name: 'Hot Beverages', description: 'Coffee & tea', icon: '☕', sortOrder: 1, createdBy: superAdmin._id },
    { name: 'Cold Beverages', description: 'Iced drinks & shakes', icon: '🥤', sortOrder: 2, createdBy: superAdmin._id },
    { name: 'Pastries', description: 'Baked treats', icon: '🥐', sortOrder: 3, createdBy: superAdmin._id },
    { name: 'Main Course', description: 'Hearty meals', icon: '🍝', sortOrder: 4, createdBy: superAdmin._id },
    { name: 'Desserts', description: 'Sweet endings', icon: '🍰', sortOrder: 5, createdBy: superAdmin._id },
  ]);
  const catBy = Object.fromEntries(categories.map((c) => [c.name, c._id]));

  const ingredients = await Ingredient.insertMany([
    { name: 'Coffee Beans', unit: 'g', category: 'Beverage', baseCost: 1.2 },
    { name: 'Milk', unit: 'ml', category: 'Dairy', baseCost: 0.05 },
    { name: 'Sugar', unit: 'g', category: 'General', baseCost: 0.04 },
    { name: 'Tea Leaves', unit: 'g', category: 'Beverage', baseCost: 0.8 },
    { name: 'Flour', unit: 'g', category: 'Bakery', baseCost: 0.03 },
    { name: 'Butter', unit: 'g', category: 'Dairy', baseCost: 0.5 },
    { name: 'Cheese', unit: 'g', category: 'Dairy', baseCost: 0.9 },
    { name: 'Chocolate', unit: 'g', category: 'Bakery', baseCost: 1.1 },
    { name: 'Mango Pulp', unit: 'ml', category: 'Fruit', baseCost: 0.3 },
    { name: 'Tomato', unit: 'g', category: 'Vegetable', baseCost: 0.06 },
  ]);
  const ingBy = Object.fromEntries(ingredients.map((i) => [i.name, i]));

  // Base menu blueprint with recipes and modifier groups.
  const blueprint = [
    { name: 'Espresso', cat: 'Hot Beverages', price: 150, cost: 45, diet: 'veg', prep: 5, recipe: [['Coffee Beans', 18, 'g']], mods: [{ name: 'Size', selectionType: 'single', required: true, options: [{ label: 'Single', priceDelta: 0 }, { label: 'Double', priceDelta: 40 }] }] },
    { name: 'Cappuccino', cat: 'Hot Beverages', price: 200, cost: 70, diet: 'veg', prep: 8, recipe: [['Coffee Beans', 18, 'g'], ['Milk', 150, 'ml']], mods: [{ name: 'Milk', selectionType: 'single', required: false, options: [{ label: 'Regular', priceDelta: 0 }, { label: 'Oat (+₹30)', priceDelta: 30 }] }] },
    { name: 'Masala Chai', cat: 'Hot Beverages', price: 90, cost: 25, diet: 'veg', prep: 6, recipe: [['Tea Leaves', 8, 'g'], ['Milk', 120, 'ml'], ['Sugar', 10, 'g']], mods: [] },
    { name: 'Iced Latte', cat: 'Cold Beverages', price: 220, cost: 80, diet: 'veg', prep: 6, recipe: [['Coffee Beans', 18, 'g'], ['Milk', 180, 'ml']], mods: [{ name: 'Sweetness', selectionType: 'single', required: false, options: [{ label: 'Normal', priceDelta: 0 }, { label: 'Less Sugar', priceDelta: 0 }] }] },
    { name: 'Mango Shake', cat: 'Cold Beverages', price: 250, cost: 100, diet: 'veg', prep: 10, recipe: [['Mango Pulp', 120, 'ml'], ['Milk', 200, 'ml'], ['Sugar', 20, 'g']], mods: [] },
    { name: 'Croissant', cat: 'Pastries', price: 120, cost: 40, diet: 'veg', prep: 3, recipe: [['Flour', 80, 'g'], ['Butter', 40, 'g']], mods: [] },
    { name: 'Chocolate Muffin', cat: 'Pastries', price: 110, cost: 35, diet: 'veg', prep: 3, recipe: [['Flour', 70, 'g'], ['Chocolate', 30, 'g'], ['Sugar', 25, 'g']], mods: [] },
    { name: 'Margherita Pizza', cat: 'Main Course', price: 400, cost: 180, diet: 'veg', prep: 25, recipe: [['Flour', 200, 'g'], ['Cheese', 100, 'g'], ['Tomato', 80, 'g']], mods: [{ name: 'Add-ons', selectionType: 'multiple', required: false, maxSelections: 3, options: [{ label: 'Extra Cheese', priceDelta: 60 }, { label: 'Olives', priceDelta: 40 }, { label: 'Jalapeño', priceDelta: 30 }] }] },
    { name: 'Pasta Alfredo', cat: 'Main Course', price: 350, cost: 150, diet: 'veg', prep: 20, recipe: [['Flour', 150, 'g'], ['Cheese', 80, 'g'], ['Butter', 30, 'g']], mods: [] },
    { name: 'Chocolate Brownie', cat: 'Desserts', price: 160, cost: 55, diet: 'veg', prep: 4, recipe: [['Flour', 60, 'g'], ['Chocolate', 50, 'g'], ['Butter', 30, 'g'], ['Sugar', 30, 'g']], mods: [{ name: 'Serve', selectionType: 'single', required: false, options: [{ label: 'Plain', priceDelta: 0 }, { label: 'With Ice Cream', priceDelta: 50 }] }] },
  ];

  const allMenuItems = [];
  const menuByLoc = {};
  for (const loc of locations) {
    menuByLoc[loc._id] = [];
    for (const bp of blueprint) {
      const hasDiscount = ['Mango Shake', 'Margherita Pizza'].includes(bp.name);
      const item = await MenuItem.create({
        name: bp.name, category: catBy[bp.cat], price: bp.price, costPrice: bp.cost,
        originalPrice: hasDiscount ? bp.price : undefined,
        discountedPrice: hasDiscount ? round2(bp.price * 0.9) : undefined,
        description: `Freshly prepared ${bp.name}`, isAvailable: true, preparationTime: bp.prep,
        locationId: loc._id, availableBranches: [loc._id], isGlobal: false,
        createdBy: superAdmin._id, dietaryType: bp.diet, stock: 100,
        modifierGroups: bp.mods,
        image: 'https://res.cloudinary.com/demo/image/upload/v1/cafeos/menu-placeholder.jpg',
      });
      const recipe = await Recipe.create({
        menuItemId: item._id,
        ingredients: bp.recipe.map(([n, q, u]) => ({ ingredient: ingBy[n]._id, name: n, quantity: q, unit: u })),
        instructions: [{ step: 1, text: `Prepare ${bp.name} ingredients` }, { step: 2, text: 'Cook/assemble per standard' }, { step: 3, text: 'Plate and serve' }],
        notes: `Standard recipe for ${bp.name}`, createdBy: superAdmin._id,
      });
      item.recipeId = recipe._id;
      await item.save();
      allMenuItems.push(item);
      menuByLoc[loc._id].push(item);
    }
  }

  // ----- Branch inventory & stock -----
  console.log('📦 Branch inventory & stock...');
  const branchInventory = [];
  const branchStock = [];
  for (const loc of locations) {
    for (const ing of ingredients) {
      branchInventory.push({ ingredient: ing._id, branch: loc._id, stock: 2000 + rand(8000), minThreshold: 500, costPerUnit: round2(ing.baseCost * (1 + Math.random())), lastRestocked: daysAgo(rand(10)) });
    }
    for (const item of menuByLoc[loc._id]) {
      branchStock.push({ menuItem: item._id, branch: loc._id, stock: 40 + rand(80), isAvailable: true });
    }
  }
  await BranchInventory.insertMany(branchInventory);
  await BranchStock.insertMany(branchStock);

  // ----- Tables -----
  console.log('🪑 Tables...');
  const tablesByLoc = {};
  for (const loc of locations) {
    const docs = [];
    for (let i = 1; i <= 12; i++) {
      docs.push({ tableNumber: i, locationId: loc._id, tableName: `T${i}`, capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2, status: 'available', isBooked: false, numberOfPeople: 0, createdBy: superAdmin._id });
    }
    tablesByLoc[loc._id] = await Table.insertMany(docs);
  }

  // ----- Customers -----
  console.log('🧑‍🤝‍🧑 Customers...');
  const firstNames = ['Aarav', 'Vivaan', 'Aditi', 'Diya', 'Ishaan', 'Ananya', 'Kabir', 'Saanvi', 'Reyansh', 'Myra', 'Vihaan', 'Anika', 'Arnav', 'Navya', 'Aryan', 'Pari', 'Krishna', 'Riya', 'Sai', 'Kiara'];
  const customers = [];
  for (let i = 0; i < 40; i++) {
    const spend = 500 + rand(60000);
    customers.push({
      phone: `70${String(10000000 + i).slice(0, 8)}`,
      name: `${pick(firstNames)} ${pick(['Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Singh', 'Gupta'])}`,
      email: `customer${i}@example.com`,
      visits: 1 + rand(40), totalSpend: spend, loyaltyPoints: Math.floor(spend / 100),
      lastVisit: daysAgo(rand(30)), branch: pick(allLocIds),
    });
  }
  const customerDocs = await Customer.insertMany(customers);

  // ----- Coupons -----
  console.log('🎟️  Coupons...');
  const coupons = await Coupon.insertMany([
    { code: 'WELCOME50', discountType: 'percentage', discountValue: 50, maxDiscount: 100, minOrderAmount: 200, expiryDate: daysAgo(-60), usageLimit: 500, usedCount: 37, isActive: true, createdBy: superAdmin._id },
    { code: 'FLAT100', discountType: 'fixed', discountValue: 100, minOrderAmount: 500, expiryDate: daysAgo(-45), usageLimit: 200, usedCount: 12, isActive: true, createdBy: superAdmin._id },
    { code: 'SWEET20', discountType: 'percentage', discountValue: 20, maxDiscount: 80, minOrderAmount: 150, expiryDate: daysAgo(-30), usageLimit: null, usedCount: 88, isActive: true, appliesTo: { items: [], categories: [catBy['Desserts'], catBy['Pastries']] }, createdBy: admins[0]._id },
    { code: 'EXPIRED10', discountType: 'percentage', discountValue: 10, minOrderAmount: 0, expiryDate: daysAgo(5), usageLimit: 100, usedCount: 100, isActive: false, createdBy: superAdmin._id },
  ]);

  // ----- Orders + Revenue transactions (GST-exclusive revenue) -----
  console.log('🧾 Orders & revenue transactions...');
  const orders = [];
  const revenueTxns = [];
  let invoiceSeq = { [loc1._id]: 1, [loc2._id]: 1, [loc3._id]: 1 };
  const orderTypes = ['dine-in', 'dine-in', 'dine-in', 'takeaway', 'delivery'];
  const payTypes = ['CASH', 'UPI', 'CARD', 'UPI', 'CASH'];

  for (let i = 0; i < 600; i++) {
    const loc = pick(locations);
    const menu = menuByLoc[loc._id];
    const orderType = pick(orderTypes);
    const table = orderType === 'dine-in' ? pick(tablesByLoc[loc._id]) : null;
    const s = staffByLoc(loc._id);
    const c = chefByLoc(loc._id);
    const cust = pick(customerDocs);
    const created = daysAgo(rand(30));
    const svcRate = svcRateByLoc[loc._id] / 100;

    const numItems = 1 + rand(3);
    const items = [];
    let subtotal = 0;
    let cost = 0;
    for (let j = 0; j < numItems; j++) {
      const mi = pick(menu);
      const qty = 1 + rand(3);
      const modifiers = [];
      let unit = mi.discountedPrice || mi.price;
      if (mi.modifierGroups?.length && Math.random() > 0.5) {
        const g = mi.modifierGroups[0];
        const opt = pick(g.options);
        if (opt.priceDelta) { modifiers.push({ groupName: g.name, label: opt.label, priceDelta: opt.priceDelta }); unit += opt.priceDelta; }
      }
      items.push({ menuItem: mi._id, itemName: mi.name, price: round2(unit), costPrice: mi.costPrice, quantity: qty, modifiers, status: 'served' });
      subtotal += unit * qty;
      cost += mi.costPrice * qty;
    }
    subtotal = round2(subtotal);

    // ~10% get a coupon discount
    let discount = 0;
    let coupon = null;
    if (Math.random() > 0.9 && subtotal >= 200) { discount = Math.min(100, round2(subtotal * 0.1)); coupon = coupons[0]._id; }

    const r = Math.random();
    let status, isBilled;
    if (r < 0.72) { status = 'COMPLETED'; isBilled = true; }
    else if (r < 0.80) { status = 'PLACED'; isBilled = false; }
    else if (r < 0.86) { status = 'PREPARING'; isBilled = false; }
    else if (r < 0.92) { status = 'READY'; isBilled = false; }
    else if (r < 0.97) { status = 'CANCELLED'; isBilled = false; }
    else { status = 'REJECTED'; isBilled = false; }

    const taxable = round2(Math.max(0, subtotal - discount));
    const serviceCharge = round2(taxable * svcRate);
    const taxAmount = round2((taxable + serviceCharge) * 0.05);
    const grandTotal = Math.round(taxable + serviceCharge + taxAmount);
    const profit = round2((subtotal - cost) - discount);
    const payType = pick(payTypes);

    const oid = new mongoose.Types.ObjectId();
    const history = [{ status: 'PLACED', timestamp: created, updatedBy: s._id }];
    if (isBilled) history.push({ status: 'COMPLETED', timestamp: new Date(created.getTime() + 35 * 60000), updatedBy: s._id });

    orders.push({
      _id: oid, branch: loc._id, orderType, table: table ? table._id : undefined,
      customerPhone: cust.phone, customerName: cust.name, createdBy: s._id, source: 'staff',
      assignedChef: c._id, servedBy: isBilled ? s._id : null, items, status,
      isBilled, totalAmount: subtotal, paymentType: payType,
      paymentStatus: isBilled ? 'paid' : 'unpaid',
      amountPaid: isBilled ? grandTotal : 0,
      discountAmount: discount, taxAmount: isBilled ? taxAmount : 0,
      serviceCharge: isBilled ? serviceCharge : 0, grandTotal: isBilled ? grandTotal : 0,
      invoiceNumber: isBilled ? `INV-${loc.city.slice(0, 3).toUpperCase()}-${String(invoiceSeq[loc._id]++).padStart(5, '0')}` : null,
      coupon, completedAt: isBilled ? new Date(created.getTime() + 35 * 60000) : null,
      createdAt: created, statusHistory: history,
      rejectReason: status === 'REJECTED' ? 'Item out of stock' : undefined,
      refundReason: undefined,
    });

    if (isBilled) {
      // REVENUE is GST-EXCLUSIVE (sales value = taxable). GST/service are not income.
      revenueTxns.push({
        locationId: loc._id, type: 'REVENUE', source: 'ORDER', orderId: oid,
        paymentType: payType, staffId: s._id, createdBy: s._id,
        title: `Order #${oid.toString().slice(-6).toUpperCase()}`, category: 'Sales',
        customerName: cust.name,
        orders: items.map((it) => ({ menuItemId: it.menuItem, itemName: it.itemName, quantity: it.quantity, price: it.price, costPrice: it.costPrice })),
        // GST-EXCLUSIVE sales value, matching utils/orderFinalizer.js (order.totalAmount).
        totalAmount: subtotal, totalProfit: profit, date: created, status: 'approved',
      });
    }
  }
  // createdAt/completedAt are set explicitly; disable timestamp overwrite for orders.
  await Order.insertMany(orders, { timestamps: false });
  await Transaction.insertMany(revenueTxns);

  // ----- Operating expenses (Expense docs + EXPENSE transactions) -----
  console.log('💸 Expenses...');
  const expenseCats = ['Rent', 'Electricity', 'Water', 'Maintenance', 'Marketing', 'Inventory', 'Salary'];
  const expenseDocs = [];
  const expenseTxns = [];
  for (const loc of locations) {
    const ba = branchAdmins.find((b) => b.assignedLocation.toString() === loc._id.toString()) || admins[0];
    for (let i = 0; i < 25; i++) {
      const cat = expenseCats[i % expenseCats.length];
      const amount = 1000 + rand(15000);
      const date = daysAgo(rand(30));
      const eid = new mongoose.Types.ObjectId();
      expenseDocs.push({ _id: eid, title: `${cat} payment`, description: `Monthly ${cat.toLowerCase()} expense for ${loc.name}`, amount, profit: -amount, type: 'EXPENSE', category: cat, status: 'approved', date, locationId: loc._id, createdBy: ba._id, proofImage: PROOF });
      expenseTxns.push({ locationId: loc._id, type: 'EXPENSE', source: 'MANUAL', expenseId: eid, title: `${cat} payment`, description: `Monthly ${cat.toLowerCase()} expense`, category: cat, totalAmount: amount, totalProfit: -amount, date, status: 'approved', createdBy: ba._id, billImage: PROOF });
    }
  }
  await Expense.insertMany(expenseDocs);
  await Transaction.insertMany(expenseTxns);

  // ----- Attendance (last 30 days) -----
  console.log('🗓️  Attendance...');
  const employees = [...branchAdmins, ...locationAdmins, ...chefs, ...staff];
  const attendance = [];
  for (const emp of employees) {
    for (let d = 0; d < 30; d++) {
      const date = daysAgo(d);
      const dow = date.getDay();
      let status, checkIn = null, checkOut = null, workedMinutes = 0, isLate = false;
      if (dow === 0) { status = 'week-off'; }
      else {
        const r = Math.random();
        if (r < 0.82) {
          status = 'present';
          const inH = 9, inM = rand(25); // some late after 9:10
          checkIn = new Date(date); checkIn.setHours(inH, inM, 0, 0);
          checkOut = new Date(date); checkOut.setHours(18, rand(40), 0, 0);
          workedMinutes = Math.round((checkOut - checkIn) / 60000);
          isLate = inM > 10;
        } else if (r < 0.9) {
          status = 'half-day';
          checkIn = new Date(date); checkIn.setHours(9, rand(20), 0, 0);
          checkOut = new Date(date); checkOut.setHours(13, rand(30), 0, 0);
          workedMinutes = Math.round((checkOut - checkIn) / 60000);
        } else if (r < 0.95) { status = 'leave'; }
        else { status = 'absent'; }
      }
      attendance.push({ user: emp._id, locationId: emp.assignedLocation, date: ymd(date), status, checkIn, checkOut, workedMinutes, isLate, markedBy: emp.assignedLocation ? (branchAdmins.find((b) => b.assignedLocation.toString() === emp.assignedLocation.toString())?._id || superAdmin._id) : superAdmin._id });
    }
  }
  await Attendance.insertMany(attendance);

  // ----- Payroll (previous month) -----
  console.log('💰 Payroll...');
  const prevMonth = monthKey(daysAgo(30));
  const payrolls = [];
  const payrollLedgerExpenses = [];
  const payrollLedgerTxns = [];
  for (const emp of [...branchAdmins, ...locationAdmins, ...chefs, ...staff]) {
    const base = emp.monthlySalary || 30000;
    const dailyRate = round2(base / 26);
    const payableDays = 24 + rand(3);
    const baseSalary = round2(dailyRate * payableDays);
    const penalties = { lateMark: rand(3) * 200, absent: rand(2) * Math.round(dailyRate), leave: 0 };
    const bonuses = { topSeller: emp.role === 'staff' && Math.random() > 0.7 ? 2000 : 0, performance: Math.random() > 0.8 ? 1500 : 0, extraShifts: 0 };
    const net = round2(baseSalary - penalties.lateMark - penalties.absent - penalties.leave + bonuses.topSeller + bonuses.performance + bonuses.extraShifts);
    const r = Math.random();
    let status = r < 0.4 ? 'PAID' : r < 0.6 ? 'FINAL_APPROVED' : r < 0.8 ? 'PENDING_ADMIN_APPROVAL' : 'PENDING_BRANCH_APPROVAL';
    let ledgerExpenseId = null;
    if (status === 'PAID') {
      const eid = new mongoose.Types.ObjectId();
      ledgerExpenseId = eid;
      const date = daysAgo(2);
      payrollLedgerExpenses.push({ _id: eid, title: `Salary — ${emp.name}`, description: `Payroll ${prevMonth} for ${emp.name}`, amount: net, profit: -net, type: 'EXPENSE', category: 'Salary', status: 'approved', date, locationId: emp.assignedLocation, createdBy: superAdmin._id, proofImage: PROOF });
      payrollLedgerTxns.push({ locationId: emp.assignedLocation, type: 'EXPENSE', source: 'MANUAL', expenseId: eid, title: `Salary — ${emp.name}`, category: 'Salary', totalAmount: net, totalProfit: -net, date, status: 'approved', createdBy: superAdmin._id });
    }
    payrolls.push({ user: emp._id, month: prevMonth, dailyRate, payableDays, baseSalary, penalties, bonuses, netSalary: net, status, approvedByBranchAt: status !== 'PENDING_BRANCH_APPROVAL' ? daysAgo(4) : undefined, approvedByAdminAt: ['FINAL_APPROVED', 'PAID'].includes(status) ? daysAgo(3) : undefined, approvedBySuperAdminAt: status === 'PAID' ? daysAgo(2) : undefined, ledgerExpenseId });
  }
  await Payroll.insertMany(payrolls);
  if (payrollLedgerExpenses.length) { await Expense.insertMany(payrollLedgerExpenses); await Transaction.insertMany(payrollLedgerTxns); }

  // ----- Leave requests -----
  console.log('📝 Leave requests...');
  const leaves = [];
  for (const emp of [...chefs, ...staff]) {
    leaves.push({ user: emp._id, locationId: emp.assignedLocation, fromDate: ymd(daysAgo(-3)), toDate: ymd(daysAgo(-5 - rand(2))) , type: pick(['paid', 'sick', 'casual']), reason: pick(['Family function', 'Medical', 'Personal work']), status: pick(['pending', 'approved', 'rejected']) });
  }
  // Fix from<to ordering (fromDate should be <= toDate)
  for (const l of leaves) { if (l.fromDate > l.toDate) { const t = l.fromDate; l.fromDate = l.toDate; l.toDate = t; } }
  await LeaveRequest.insertMany(leaves.map((l) => ({ ...l, reviewedBy: l.status !== 'pending' ? superAdmin._id : undefined, reviewedAt: l.status !== 'pending' ? daysAgo(1) : undefined, reviewNote: l.status === 'rejected' ? 'Insufficient coverage' : (l.status === 'approved' ? 'Approved' : '') })));

  // ----- Gift cards -----
  console.log('🎁 Gift cards...');
  await GiftCard.create([
    { code: 'GIFT-CENTRAL-500', initialBalance: 500, balance: 500, locationId: null, issuedToName: 'Aarav Sharma', issuedToPhone: '7010000001', issuedBy: admins[0]._id, isActive: true, expiresAt: daysAgo(-180), transactions: [{ type: 'issue', amount: 500, by: admins[0]._id, note: 'New issue' }] },
    { code: 'GIFT-MUM-1000', initialBalance: 1000, balance: 685, locationId: loc1._id, issuedToName: 'Diya Patel', issuedToPhone: '7010000002', issuedBy: branchAdmins[0]._id, isActive: true, transactions: [{ type: 'issue', amount: 1000, by: branchAdmins[0]._id }, { type: 'redeem', amount: 315, by: staff[0]._id, note: 'Order settlement' }] },
    { code: 'GIFT-DEL-250', initialBalance: 250, balance: 250, locationId: loc2._id, issuedToName: 'Kabir Singh', issuedToPhone: '7010000003', issuedBy: branchAdmins[3]._id, isActive: true, transactions: [{ type: 'issue', amount: 250, by: branchAdmins[3]._id }] },
  ]);

  // ----- Feedback -----
  console.log('⭐ Feedback...');
  const completedOrderIds = orders.filter((o) => o.isBilled).slice(0, 30);
  const feedback = [];
  for (let i = 0; i < 30; i++) {
    const o = completedOrderIds[i % completedOrderIds.length];
    const rating = 3 + rand(3) > 5 ? 5 : 3 + rand(3);
    feedback.push({ locationId: o.branch, orderId: o._id, customerName: o.customerName, customerPhone: o.customerPhone, rating: Math.min(5, rating), foodRating: Math.min(5, 3 + rand(3)), serviceRating: Math.min(5, 3 + rand(3)), comment: pick(['Great coffee!', 'Loved the ambience', 'Service was a bit slow', 'Will visit again', 'Pizza was excellent', 'Value for money']), source: pick(['qr', 'web', 'staff']) });
  }
  await Feedback.insertMany(feedback);

  // ----- Suppliers & purchase orders -----
  console.log('🚚 Suppliers & purchase orders...');
  const suppliers = await Supplier.create([
    { name: 'BeanCo Roasters', phone: '7020000001', email: 'sales@beanco.in', address: 'Pune', gstin: '27AABCB1111Q1Z5', paymentTerms: 'Net 15', locationId: null, createdBy: superAdmin._id },
    { name: 'FreshDairy Pvt Ltd', phone: '7020000002', email: 'orders@freshdairy.in', address: 'Mumbai', paymentTerms: 'On delivery', locationId: loc1._id, createdBy: branchAdmins[0]._id },
    { name: 'GrainMart', phone: '7020000003', email: 'hello@grainmart.in', address: 'Delhi', paymentTerms: 'Net 30', locationId: loc2._id, createdBy: branchAdmins[3]._id },
  ]);
  const poExpenses = [];
  const poTxns = [];
  const purchaseOrders = [];
  for (const loc of locations) {
    const ba = branchAdmins.find((b) => b.assignedLocation.toString() === loc._id.toString()) || admins[0];
    for (let k = 0; k < 3; k++) {
      const items = [ingredients[rand(ingredients.length)], ingredients[rand(ingredients.length)]].map((ing) => {
        const quantity = 1000 + rand(5000); const unitCost = round2(ing.baseCost); return { ingredient: ing._id, name: ing.name, unit: ing.unit, quantity, unitCost, lineTotal: round2(quantity * unitCost) };
      });
      const total = round2(items.reduce((a, it) => a + it.lineTotal, 0));
      const received = k === 0;
      const poId = new mongoose.Types.ObjectId();
      let expenseId = null;
      if (received) {
        expenseId = new mongoose.Types.ObjectId();
        const date = daysAgo(rand(15));
        poExpenses.push({ _id: expenseId, title: `Purchase — ${suppliers[0].name}`, description: `PO received at ${loc.name}`, amount: total, profit: -total, type: 'EXPENSE', category: 'Inventory', status: 'approved', date, locationId: loc._id, createdBy: ba._id, proofImage: PROOF });
        poTxns.push({ locationId: loc._id, type: 'EXPENSE', source: 'MANUAL', expenseId, title: `Purchase — ${suppliers[0].name}`, category: 'Inventory', totalAmount: total, totalProfit: -total, date, status: 'approved', createdBy: ba._id });
      }
      purchaseOrders.push({ _id: poId, supplier: suppliers[0]._id, locationId: loc._id, items, totalAmount: total, status: received ? 'received' : (k === 1 ? 'ordered' : 'ordered'), notes: received ? 'Delivered in full' : 'Awaiting delivery', createdBy: ba._id, receivedBy: received ? ba._id : undefined, receivedAt: received ? daysAgo(rand(15)) : undefined, expenseId });
    }
  }
  await PurchaseOrder.insertMany(purchaseOrders);
  if (poExpenses.length) { await Expense.insertMany(poExpenses); await Transaction.insertMany(poTxns); }

  // ----- Cash sessions (Z-reports) -----
  console.log('💵 Cash sessions...');
  for (const loc of locations) {
    const s = staffByLoc(loc._id);
    // a few closed sessions in the past
    for (let d = 5; d >= 2; d--) {
      const openedAt = daysAgo(d); openedAt.setHours(9, 0, 0, 0);
      const closedAt = daysAgo(d); closedAt.setHours(21, 0, 0, 0);
      const float = 1000;
      const cashSales = 3000 + rand(7000);
      const payIn = 500; const payOut = 200; const refunds = rand(300);
      const expected = float + cashSales + payIn - payOut - refunds;
      const variance = pick([0, 0, 0, -50, 100, -20]);
      await CashSession.create({ locationId: loc._id, status: 'closed', openedBy: s._id, openedAt, openingFloat: float, movements: [{ type: 'in', amount: payIn, reason: 'Change top-up', by: s._id, at: openedAt }, { type: 'out', amount: payOut, reason: 'Petty cash', by: s._id, at: closedAt }], closedBy: s._id, closedAt, countedCash: expected + variance, cashSales, cashRefunds: refunds, expectedCash: expected, variance, notes: variance === 0 ? 'Balanced' : 'Minor variance' });
    }
    // one currently-open session for branch 1 only (unique open per branch)
    if (loc._id.toString() === loc1._id.toString()) {
      const openedAt = new Date(); openedAt.setHours(9, 0, 0, 0);
      await CashSession.create({ locationId: loc._id, status: 'open', openedBy: s._id, openedAt, openingFloat: 1000, movements: [], cashSales: 0, cashRefunds: 0 });
    }
  }

  // ----- Reservations -----
  console.log('📅 Reservations...');
  const reservations = [];
  for (const loc of locations) {
    const s = staffByLoc(loc._id);
    const tbls = tablesByLoc[loc._id];
    reservations.push({ eventName: 'Birthday Dinner', reservationType: 'table', userId: s._id, locationId: loc._id, tableIds: [tbls[0]._id, tbls[1]._id], date: daysAgo(-3), startTime: '19:00', endTime: '21:00', customerName: 'Ananya Reddy', customerPhone: '7030000001', totalAmount: 5000, advancePayment: 1000, paymentStatus: 'partial', status: 'confirmed', notes: 'Need a cake' });
    reservations.push({ eventName: 'Corporate Lunch', reservationType: 'full-location', userId: s._id, locationId: loc._id, tableIds: tbls.map((t) => t._id), date: daysAgo(-7), startTime: '12:00', endTime: '15:00', isFullDay: false, customerName: 'TechCorp Pvt Ltd', customerPhone: '7030000002', totalAmount: 25000, advancePayment: 10000, paymentStatus: 'partial', status: 'pending' });
  }
  await Reservation.insertMany(reservations);

  // ----- Bookings (public table bookings) -----
  console.log('📖 Bookings...');
  const bookings = [];
  for (const loc of locations) {
    bookings.push({ guestName: 'Walk-in Guest', guestEmail: 'guest1@example.com', guestPhone: '7040000001', locationId: loc._id, date: daysAgo(-2), startTime: '18:00', endTime: '20:00', numberOfGuests: 4, status: 'confirmed', specialRequests: 'Window seat' });
    bookings.push({ guestName: 'Anniversary Couple', guestEmail: 'guest2@example.com', guestPhone: '7040000002', locationId: loc._id, date: daysAgo(-4), startTime: '20:00', endTime: '22:00', numberOfGuests: 2, status: 'pending' });
  }
  await Booking.insertMany(bookings);

  // ----- Waitlist -----
  console.log('⏳ Waitlist...');
  const waitlist = [];
  for (const loc of locations) {
    const s = staffByLoc(loc._id);
    waitlist.push({ locationId: loc._id, customerName: 'Sai Kumar', customerPhone: '7050000001', partySize: 3, quotedWaitMinutes: 15, status: 'waiting', addedBy: s._id });
    waitlist.push({ locationId: loc._id, customerName: 'Riya Nair', customerPhone: '7050000002', partySize: 2, quotedWaitMinutes: 10, status: 'seated', addedBy: s._id, tableId: tablesByLoc[loc._id][2]._id, seatedAt: new Date() });
  }
  await Waitlist.insertMany(waitlist);

  // ----- Waste records -----
  console.log('🗑️  Waste records...');
  const waste = [];
  for (const loc of locations) {
    const ba = branchAdmins.find((b) => b.assignedLocation.toString() === loc._id.toString()) || admins[0];
    for (let k = 0; k < 4; k++) {
      waste.push({ branch: loc._id, ingredient: pick(ingredients)._id, quantity: 50 + rand(500), reason: pick(['expired', 'spillage', 'damaged', 'other']), notes: 'Routine kitchen log', recordedBy: ba._id, date: daysAgo(rand(20)) });
    }
  }
  await WasteRecord.insertMany(waste);

  // ----- Notifications -----
  console.log('🔔 Notifications...');
  const notifs = [];
  notifs.push({ title: 'Welcome to CafeOS', message: 'Your account has been provisioned. Explore your dashboard.', type: 'announcement', priority: 'medium', sender: superAdmin._id, roleTarget: 'all', recipients: employees.map((e) => ({ user: e._id, isRead: Math.random() > 0.5 })) });
  for (const loc of locations) {
    const team = employeesByLoc(loc._id);
    notifs.push({ title: `${loc.name}: Month-end targets`, message: 'Please ensure all bills are closed before the shift ends.', type: 'alert', priority: 'high', sender: admins[0]._id, roleTarget: 'staff', locationTarget: loc._id, recipients: team.map((e) => ({ user: e._id, isRead: false })) });
  }
  notifs.push({ title: 'Direct message', message: 'Great work on yesterday\'s rush!', type: 'message', priority: 'low', sender: admins[0]._id, recipients: [{ user: staff[0]._id, isRead: false }] });
  await Notification.insertMany(notifs);

  // ----- Audit logs -----
  console.log('📜 Audit logs...');
  const audits = [];
  audits.push({ action: 'SEED_INIT', performedBy: superAdmin._id, role: 'super_admin', details: 'Database seeded', metadata: { source: 'seed' }, timestamp: new Date() });
  for (const a of admins) audits.push({ action: 'LOGIN', performedBy: a._id, role: 'admin', details: `${a.name} logged in`, metadata: { ip: '127.0.0.1' }, locationId: null, timestamp: daysAgo(rand(3)) });
  for (const loc of locations) audits.push({ action: 'BRANCH_CONFIG_UPDATE', performedBy: superAdmin._id, role: 'super_admin', details: `Updated settings for ${loc.name}`, metadata: {}, locationId: loc._id, timestamp: daysAgo(rand(10)) });
  await AuditLog.insertMany(audits);

  // ----- Summary -----
  const counts = {};
  for (const m of ALL_COLLECTIONS) counts[m.modelName] = await m.countDocuments();
  console.log('\n✅ Seed complete. Document counts:');
  console.table(counts);
  console.log('\n🔑 Login (QuickLogin): all accounts use password "password123"');
  console.log('   super@cafeos.com · rajesh.admin@cafeos.com · arjun.ba1@cafeos.com · sneha.la1@cafeos.com · ramesh.chef1@cafeos.com · priya.staff1@cafeos.com');
};

const run = async () => {
  try {
    await connectDB();
    console.log('🔌 Connected to MongoDB.');
    const clearOnly = process.argv.includes('--clear');
    await clearAll();
    if (clearOnly) { console.log('✅ Cleared. (--clear)'); process.exit(0); }
    await seed();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
};

run();
