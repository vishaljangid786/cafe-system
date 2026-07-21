/**
 * Moon Light Cafe — the ONLY dataset this project seeds.
 *
 * Creates exactly one cafe and everything beneath it, and nothing else:
 *   • 1 super admin  (anil@Moon-light-cafe.com)
 *   • 1 cafe         ("Moon light cafe") with 1 admin/owner
 *   • 3 branches, each with its own branch admin
 *   • 3 staff + 2 chefs per branch  (9 staff, 6 chefs)
 *   • menu: some items cafe-wide (isGlobal), some assigned to specific branches
 *   • categories, tables and per-branch stock for the above
 *
 * Runs ONCE, only when the database has no users (see utils/startupMigrations.js).
 *
 * Manual run:  npm run seed
 */

const mongoose = require('mongoose');

const Cafe = require('../models/Cafe');
const Location = require('../models/Location');
const User = require('../models/User');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const BranchStock = require('../models/BranchStock');

// Shared across every seeded account. Must satisfy the User model's 10-char minimum.
const PASSWORD = 'Moonlight@2026';
const SUPER_ADMIN_EMAIL = 'anil@Moon-light-cafe.com';
const CAFE_NAME = 'Moon light cafe';

const FULL_PERMS = {
  viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
  forceComplete: true, exportReports: true, manageStaff: true,
  manageNotifications: true, viewAnalytics: true, manageCoupons: true,
};
const BRANCH_ADMIN_PERMS = {
  viewOrders: true, manageOrders: true, manageStaff: true,
  viewAnalytics: true, viewRevenue: true, exportReports: true,
};
const STAFF_PERMS = { viewOrders: true, manageOrders: true };

// Aadhaar is required + encrypted on the User model; these are obvious dummies.
let aadharSeq = 100000000000;
const nextAadhar = () => String(++aadharSeq).padStart(12, '0');

let phoneSeq = 9800000000;
const nextPhone = () => String(++phoneSeq);

const BRANCHES = [
  { name: 'Moon Light — Koregaon Park', city: 'Pune', state: 'MH', pincode: '411001' },
  { name: 'Moon Light — Bandra', city: 'Mumbai', state: 'MH', pincode: '400050' },
  { name: 'Moon Light — Indiranagar', city: 'Bengaluru', state: 'KA', pincode: '560038' },
];

// Menu available at EVERY branch of the cafe.
const CAFE_WIDE_ITEMS = [
  { name: 'Moonlight Espresso', price: 160, prepTime: 4, cat: 'Hot Beverages', cost: 55, diet: 'veg' },
  { name: 'Cappuccino', price: 210, prepTime: 7, cat: 'Hot Beverages', cost: 72, diet: 'veg' },
  { name: 'Masala Chai', price: 90, prepTime: 5, cat: 'Hot Beverages', cost: 25, diet: 'veg' },
  { name: 'Iced Latte', price: 230, prepTime: 6, cat: 'Cold Beverages', cost: 82, diet: 'veg' },
  { name: 'Butter Croissant', price: 130, prepTime: 3, cat: 'Bakery', cost: 45, diet: 'veg' },
  { name: 'Chocolate Muffin', price: 110, prepTime: 3, cat: 'Bakery', cost: 32, diet: 'veg' },
];

// Menu available at ONE branch only — indexed by branch position (0/1/2).
const BRANCH_ONLY_ITEMS = [
  { branch: 0, name: 'Pune Misal Toastie', price: 220, prepTime: 12, cat: 'Main Course', cost: 90, diet: 'veg' },
  { branch: 0, name: 'Koregaon Cold Brew', price: 260, prepTime: 5, cat: 'Cold Beverages', cost: 95, diet: 'veg' },
  { branch: 1, name: 'Bandra Bombay Sandwich', price: 240, prepTime: 10, cat: 'Main Course', cost: 95, diet: 'veg' },
  { branch: 1, name: 'Seaside Chicken Roll', price: 320, prepTime: 15, cat: 'Main Course', cost: 140, diet: 'non-veg' },
  { branch: 2, name: 'Indiranagar Filter Coffee', price: 120, prepTime: 5, cat: 'Hot Beverages', cost: 35, diet: 'veg' },
  { branch: 2, name: 'Bengaluru Benne Dosa', price: 280, prepTime: 18, cat: 'Main Course', cost: 110, diet: 'veg' },
];

const STAFF_NAMES = [
  ['Rohit Kale', 'Sneha Patil', 'Aman Joshi'],
  ['Priya Nair', 'Zaid Khan', 'Neha Shah'],
  ['Kiran Rao', 'Divya Menon', 'Arun Pillai'],
];
const CHEF_NAMES = [
  ['Vikram Deshmukh', 'Farah Sheikh'],
  ['Imran Qureshi', 'Meera Iyer'],
  ['Suresh Gowda', 'Anita Reddy'],
];

const slugEmail = (name, i) =>
  `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${i}@moon-light-cafe.com`;

/**
 * Destructive: empties every collection this project owns. Kept separate from the
 * seed itself so nothing wipes data as a side effect — callers must ask for it.
 */
const dropAllData = async () => {
  const names = [
    'Cafe', 'Location', 'User', 'Category', 'MenuItem', 'Ingredient', 'Recipe',
    'Table', 'Customer', 'Reservation', 'Order', 'Transaction', 'Expense',
    'Payroll', 'Attendance', 'Coupon', 'Notification', 'AuditLog', 'WasteRecord',
    'BranchInventory', 'BranchStock', 'Booking', 'Waitlist', 'CashSession',
    'LeaveRequest', 'PurchaseOrder', 'Supplier', 'Settings', 'PermissionPreset',
    'BranchStock',
  ];
  for (const name of names) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const Model = require(`../models/${name}`);
      await Model.deleteMany({});
    } catch (e) {
      // A model that doesn't exist isn't an error — skip it.
      if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
  }
  console.log('[seed] All collections cleared.');
};

const seedMoonlightCafe = async () => {
  console.log('[seed] Moon Light Cafe — starting.');

  // 1. Super admin (platform level)
  const superAdmin = await User.create({
    name: 'Anil',
    email: SUPER_ADMIN_EMAIL,
    password: PASSWORD,
    phone: nextPhone(),
    gender: 'Male',
    age: 38,
    address1: 'Head Office',
    city: 'Pune', state: 'MH', country: 'India', pincode: '411001',
    role: 'super_admin',
    aadharNumber: nextAadhar(),
    aadharImage: 'https://example.com/aadhar.png',
    highestQualification: 'Graduate',
    permissions: FULL_PERMS,
  });

  // 2. The cafe
  const cafe = await Cafe.create({
    name: CAFE_NAME,
    gstin: '27AAAAA0000A1Z5',
    address: { line1: 'Moon Light HQ', city: 'Pune', state: 'MH', pincode: '411001', country: 'India' },
    contact: { phone: nextPhone(), email: 'hello@moon-light-cafe.com' },
    status: 'active',
    createdBy: superAdmin._id,
  });

  // 3. Branches
  const locations = await Location.insertMany(
    BRANCHES.map((b) => ({
      name: b.name,
      city: b.city,
      state: b.state,
      country: 'India',
      pincode: b.pincode,
      status: 'active',
      cafe: cafe._id,
      createdBy: superAdmin._id,
    }))
  );
  const branchIds = locations.map((l) => l._id);

  // 4. The cafe's admin (owner) — sees every branch of this cafe
  const admin = await User.create({
    name: 'Rhea Kapoor',
    email: 'rhea.admin@moon-light-cafe.com',
    password: PASSWORD,
    phone: nextPhone(),
    gender: 'Female',
    age: 34,
    address1: 'Moon Light HQ',
    city: 'Pune', state: 'MH', country: 'India', pincode: '411001',
    role: 'admin',
    aadharNumber: nextAadhar(),
    aadharImage: 'https://example.com/aadhar.png',
    highestQualification: 'Post Graduate',
    permissions: FULL_PERMS,
    accessibleLocations: branchIds,
    cafes: [cafe._id],
  });

  // The super admin is scoped to this cafe too, so the navbar cafe/branch
  // selectors have something selected on first login.
  await User.findByIdAndUpdate(superAdmin._id, {
    accessibleLocations: branchIds,
    cafes: [cafe._id],
  });

  // 5. One branch admin per branch, then 3 staff + 2 chefs each
  const branchAdminNames = ['Sahil Mehta', 'Ayesha Siddiqui', 'Naveen Kumar'];
  const people = { branchAdmins: [], staff: [], chefs: [] };

  for (let b = 0; b < locations.length; b += 1) {
    const loc = locations[b];
    const common = {
      password: PASSWORD,
      gender: b % 2 === 0 ? 'Male' : 'Female',
      address1: loc.name,
      city: loc.city,
      state: loc.state,
      country: 'India',
      pincode: loc.pincode,
      aadharImage: 'https://example.com/aadhar.png',
      highestQualification: 'Graduate',
      assignedLocation: loc._id,
      accessibleLocations: [loc._id],
    };

    people.branchAdmins.push(await User.create({
      ...common,
      name: branchAdminNames[b],
      email: slugEmail(branchAdminNames[b], b + 1),
      phone: nextPhone(),
      age: 30 + b,
      role: 'branch_admin',
      aadharNumber: nextAadhar(),
      permissions: BRANCH_ADMIN_PERMS,
      monthlySalary: 38000 + b * 2000,
    }));

    for (let s = 0; s < STAFF_NAMES[b].length; s += 1) {
      const name = STAFF_NAMES[b][s];
      people.staff.push(await User.create({
        ...common,
        name,
        email: slugEmail(name, `${b + 1}${s + 1}`),
        phone: nextPhone(),
        age: 22 + s,
        gender: s % 2 === 0 ? 'Male' : 'Female',
        role: 'staff',
        aadharNumber: nextAadhar(),
        permissions: STAFF_PERMS,
        // The User model's field is monthlySalary — `salary` would be silently
        // dropped by strict mode, leaving payroll/salary pages empty.
        monthlySalary: 22000 + s * 1500,
      }));
    }

    for (let c = 0; c < CHEF_NAMES[b].length; c += 1) {
      const name = CHEF_NAMES[b][c];
      people.chefs.push(await User.create({
        ...common,
        name,
        email: slugEmail(name, `${b + 1}${c + 1}`),
        phone: nextPhone(),
        age: 26 + c,
        gender: c % 2 === 0 ? 'Male' : 'Female',
        role: 'chef',
        aadharNumber: nextAadhar(),
        permissions: STAFF_PERMS,
        monthlySalary: 28000 + c * 2000,
      }));
    }
  }

  // 6. Categories (cafe-level reference data)
  const categories = await Category.insertMany([
    { name: 'Hot Beverages', description: 'Coffee, chai and more', type: 'BEVERAGE', createdBy: superAdmin._id },
    { name: 'Cold Beverages', description: 'Iced coffees and shakes', type: 'BEVERAGE', createdBy: superAdmin._id },
    { name: 'Bakery', description: 'Fresh from the oven', type: 'FOOD', createdBy: superAdmin._id },
    { name: 'Main Course', description: 'Hearty plates', type: 'FOOD', createdBy: superAdmin._id },
  ]);
  const catId = (name) => categories.find((c) => c.name === name)._id;

  // 7. Menu — cafe-wide items are isGlobal + available at every branch;
  //    branch-only items are pinned to a single branch.
  const cafeWide = CAFE_WIDE_ITEMS.map((it) => ({
    name: it.name,
    description: `${it.name} — a Moon Light favourite`,
    price: it.price,
    costPrice: it.cost,
    preparationTime: it.prepTime,
    category: catId(it.cat),
    dietaryType: it.diet,
    isAvailable: true,
    isGlobal: true,
    availableBranches: branchIds,
    createdBy: superAdmin._id,
  }));

  const branchOnly = BRANCH_ONLY_ITEMS.map((it) => ({
    name: it.name,
    description: `${it.name} — only at ${locations[it.branch].name}`,
    price: it.price,
    costPrice: it.cost,
    preparationTime: it.prepTime,
    category: catId(it.cat),
    dietaryType: it.diet,
    isAvailable: true,
    isGlobal: false,
    locationId: locations[it.branch]._id,
    availableBranches: [locations[it.branch]._id],
    createdBy: superAdmin._id,
  }));

  const menuItems = await MenuItem.insertMany([...cafeWide, ...branchOnly]);

  // 8. Per-branch stock so items are actually orderable at each branch
  const stock = [];
  for (const item of menuItems) {
    for (const bId of item.availableBranches) {
      stock.push({ menuItem: item._id, branch: bId, stock: 100, isAvailable: true });
    }
  }
  await BranchStock.insertMany(stock);

  // 9. Tables (8 per branch)
  const tables = [];
  for (const loc of locations) {
    for (let i = 1; i <= 8; i += 1) {
      tables.push({
        locationId: loc._id,
        tableNumber: i,
        capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
        status: 'available',
        createdBy: superAdmin._id,
      });
    }
  }
  await Table.insertMany(tables);

  console.log('[seed] Moon Light Cafe complete:');
  console.log(`        cafe: ${CAFE_NAME} (${locations.length} branches)`);
  console.log(`        users: 1 super admin, 1 admin, ${people.branchAdmins.length} branch admins, ${people.staff.length} staff, ${people.chefs.length} chefs`);
  console.log(`        menu: ${cafeWide.length} cafe-wide + ${branchOnly.length} branch-only items, ${tables.length} tables`);
  console.log(`        login: ${SUPER_ADMIN_EMAIL} / ${PASSWORD}`);

  return { cafe, locations, superAdmin, admin, ...people };
};

module.exports = { seedMoonlightCafe, dropAllData, PASSWORD, SUPER_ADMIN_EMAIL, CAFE_NAME };

// ── CLI ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.estimatedDocumentCount();
    if (users > 0 && !process.argv.includes('--force')) {
      console.error(`[seed] Refusing to run: the database already has ${users} user(s). Pass --force to seed anyway.`);
      await mongoose.disconnect();
      process.exit(1);
    }
    await seedMoonlightCafe();
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => {
    console.error('[seed] FAILED:', err);
    process.exit(1);
  });
}
