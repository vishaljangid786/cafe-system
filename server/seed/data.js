const branches = [
  {
    name: 'Downtown Central',
    location: { city: 'New York', state: 'NY', country: 'USA' },
    status: 'active'
  },
  {
    name: 'Uptown Bistro',
    location: { city: 'Chicago', state: 'IL', country: 'USA' },
    status: 'active'
  },
  {
    name: 'Waterfront Cafe',
    location: { city: 'Miami', state: 'FL', country: 'USA' },
    status: 'hold',
    holdReason: 'Interior Renovation'
  },
  {
    name: 'Old Town Branch',
    location: { city: 'Boston', state: 'MA', country: 'USA' },
    status: 'deleted'
  }
];

const menuItems = [
  { itemName: 'Espresso', price: 120 },
  { itemName: 'Cappuccino', price: 180 },
  { itemName: 'Cafe Latte', price: 190 },
  { itemName: 'Club Sandwich', price: 250 },
  { itemName: 'Veg Burger', price: 150 },
  { itemName: 'Chicken Pasta', price: 320 },
  { itemName: 'Margherita Pizza', price: 450 },
  { itemName: 'Chocolate Brownie', price: 150 },
  { itemName: 'Iced Tea', price: 90 },
  { itemName: 'Cold Coffee', price: 140 }
];

const users = [
  {
    name: 'Super Admin',
    email: 'superadmin@cafe.com',
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
    highestQualification: 'Post Graduate'
  },
  {
    name: 'Main Admin',
    email: 'admin@cafe.com',
    password: 'password123',
    role: 'admin',
    phone: '9876543211',
    gender: 'Female',
    age: 30,
    address1: '456 Management Ave',
    city: 'Global City',
    state: 'State',
    country: 'USA',
    aadharNumber: '123456789013',
    highestQualification: 'Graduate'
  },
  // Branch Admins
  {
    name: 'John Downtown',
    email: 'john.d@cafe.com',
    password: 'password123',
    role: 'branch_admin',
    branchName: 'Downtown Central',
    phone: '9876543212',
    gender: 'Male',
    age: 28,
    address1: '789 Branch Blvd',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    aadharNumber: '123456789014',
    highestQualification: 'Graduate'
  },
  {
    name: 'Sarah Uptown',
    email: 'sarah.u@cafe.com',
    password: 'password123',
    role: 'branch_admin',
    branchName: 'Uptown Bistro',
    phone: '9876543213',
    gender: 'Female',
    age: 29,
    address1: '321 North St',
    city: 'Chicago',
    state: 'IL',
    country: 'USA',
    aadharNumber: '123456789015',
    highestQualification: 'Graduate'
  },
  // Staff
  ...Array.from({ length: 10 }, (_, i) => ({
    name: `Staff Member ${i + 1}`,
    email: `staff${i + 1}@cafe.com`,
    password: 'password123',
    role: 'staff',
    branchName: i < 5 ? 'Downtown Central' : 'Uptown Bistro',
    phone: `987654322${i}`,
    gender: i % 2 === 0 ? 'Male' : 'Female',
    age: 20 + i,
    address1: `Staff Residence ${i + 1}`,
    city: i < 5 ? 'New York' : 'Chicago',
    state: i < 5 ? 'NY' : 'IL',
    country: 'USA',
    aadharNumber: `12345678101${i}`,
    highestQualification: 'Graduate',
    monthlySalary: 20000 + (i * 2000)
  }))
];

const categories = ['Utilities', 'Raw Materials', 'Maintenance', 'Marketing', 'Rent', 'Other'];

module.exports = { branches, users, menuItems, categories };
