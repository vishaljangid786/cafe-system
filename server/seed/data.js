const locations = [
  {
    name: 'Downtown Central',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    pincode: '10001',
    status: 'active'
  },
  {
    name: 'Uptown Bistro',
    city: 'Chicago',
    state: 'IL',
    country: 'USA',
    pincode: '60601',
    status: 'active'
  },
  {
    name: 'Waterfront Cafe',
    city: 'Miami',
    state: 'FL',
    country: 'USA',
    pincode: '33101',
    status: 'hold',
    holdReason: 'Interior Renovation'
  },
  {
    name: 'Old Town',
    city: 'Boston',
    state: 'MA',
    country: 'USA',
    pincode: '02108',
    status: 'deleted'
  },
  {
    name: 'Westside Lounge',
    city: 'Los Angeles',
    state: 'CA',
    country: 'USA',
    pincode: '90001',
    status: 'active'
  },
  {
    name: 'Tech Park Cafe',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    pincode: '94105',
    status: 'active'
  },
  {
    name: 'Suburban Retreat',
    city: 'Austin',
    state: 'TX',
    country: 'USA',
    pincode: '73301',
    status: 'active'
  },
  {
    name: 'University Campus',
    city: 'Seattle',
    state: 'WA',
    country: 'USA',
    pincode: '98105',
    status: 'active'
  },
  {
    name: 'Airport Express',
    city: 'Denver',
    state: 'CO',
    country: 'USA',
    pincode: '80249',
    status: 'active'
  },
  {
    name: 'Mall Kiosk',
    city: 'Atlanta',
    state: 'GA',
    country: 'USA',
    pincode: '30303',
    status: 'active'
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

// {
//   name: 'Super Admin',
//   email: 'superadmin@cafe.com',
//   password: 'password123',
//   role: 'super_admin',
//   phone: '9876543210',
//   gender: 'Male',
//   age: 35,
//   address1: '123 Admin St',
//   city: 'Global City',
//   state: 'State',
//   country: 'USA',
//   aadharNumber: '123456789012',
//   highestQualification: 'Post Graduate'
// },
const users = [
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
    locationName: 'Downtown Central',
    phone: '9876543212',
    gender: 'Male',
    age: 28,
    address1: '789 Hub Blvd',
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
    locationName: 'Uptown Bistro',
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
    locationName: i < 5 ? 'Downtown Central' : 'Uptown Bistro',
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

const categories = ['Utilities', 'Raw Materials', 'Maintenance', 'Marketing', 'Rent', 'Other', 'Payroll', 'Insurance', 'Taxes', 'Supplies'];

const attendances = Array.from({ length: 10 }, (_, i) => ({
  user: '60d5ec49f1b2c82a3c8b456' + i,
  locationId: '60d5ec49f1b2c82a3c8b457' + (i % 2),
  date: `2026-04-${String((i % 30) + 1).padStart(2, '0')}`,
  status: i % 3 === 0 ? 'absent' : 'present',
  markedBy: '60d5ec49f1b2c82a3c8b4560'
}));

const bookings = Array.from({ length: 10 }, (_, i) => ({
  userId: '60d5ec49f1b2c82a3c8b456' + i,
  locationId: '60d5ec49f1b2c82a3c8b457' + (i % 2),
  date: new Date(`2026-04-${String((i % 30) + 1).padStart(2, '0')}`),
  startTime: '18:00',
  endTime: '20:00',
  numberOfGuests: (i % 5) + 1,
  status: 'confirmed',
  specialRequests: i % 2 === 0 ? 'Window seat' : ''
}));

const coupons = Array.from({ length: 10 }, (_, i) => ({
  code: `SAVE${i * 10 || 10}`,
  discountType: i % 2 === 0 ? 'percentage' : 'fixed',
  discountValue: i % 2 === 0 ? 10 + i : 50 + (i * 10),
  expiryDate: new Date('2026-12-31'),
  isActive: true,
  createdBy: '60d5ec49f1b2c82a3c8b4560'
}));

const expenses = Array.from({ length: 10 }, (_, i) => ({
  title: `Expense ${i + 1}`,
  description: `Description for expense ${i + 1}`,
  amount: 100 + (i * 50),
  date: new Date(),
  locationId: '60d5ec49f1b2c82a3c8b457' + (i % 2),
  createdBy: '60d5ec49f1b2c82a3c8b4560',
  proofImage: 'https://example.com/receipt.jpg'
}));

const tables = Array.from({ length: 10 }, (_, i) => ({
  tableNumber: i + 1,
  locationId: '60d5ec49f1b2c82a3c8b457' + (i % 2),
  isBooked: false,
  status: 'available',
  numberOfPeople: 0,
  createdBy: '60d5ec49f1b2c82a3c8b4560'
}));

const notifications = Array.from({ length: 10 }, (_, i) => ({
  title: `Notification ${i + 1}`,
  message: `This is the message for notification ${i + 1}`,
  type: 'user_action',
  roleTarget: ['staff', 'branch_admin'],
  createdBy: '60d5ec49f1b2c82a3c8b4560'
}));

const recipes = Array.from({ length: 10 }, (_, i) => ({
  menuItemId: '60d5ec49f1b2c82a3c8b458' + i,
  ingredients: [
    { name: `Ingredient ${i}A`, quantity: 100, unit: 'grams' },
    { name: `Ingredient ${i}B`, quantity: 2, unit: 'pcs' }
  ],
  instructions: [
    { step: 1, text: `Mix ingredient ${i}A` },
    { step: 2, text: `Add ingredient ${i}B` }
  ],
  createdBy: '60d5ec49f1b2c82a3c8b4560'
}));

module.exports = { locations, users, menuItems, categories, attendances, bookings, coupons, expenses, tables, notifications, recipes };
