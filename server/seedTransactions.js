const mongoose = require('mongoose');
const Transaction = require('./models/Transaction');
const Location = require('./models/Location');
const User = require('./models/User');
const MenuItem = require('./models/MenuItem');
const Expense = require('./models/Expense');
require('dotenv').config();

const seedTransactions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    const locations = await Location.find({ isPermanentlyDeleted: false });
    const users = await User.find({ role: 'staff' });
    const menuItems = await MenuItem.find();

    if (locations.length === 0 || menuItems.length === 0) {
      console.log('No locations or menu items found. Please seed them first.');
      process.exit(1);
    }

    // Clear existing transactions and expenses for fresh seed
    await Transaction.deleteMany({});
    await Expense.deleteMany({ type: 'income' }); // Clear only income expenses created by transactions
    console.log('Cleared existing transactions and income expenses.');

    const transactions = [];
    const expenses = [];
    const now = new Date();

    // Create transactions for the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      locations.forEach(loc => {
        // Random number of transactions per day per location
        const count = Math.floor(Math.random() * 5) + 2; 

        for (let j = 0; j < count; j++) {
          const staff = users[Math.floor(Math.random() * users.length)] || users[0];
          
          // Random items
          const itemsCount = Math.floor(Math.random() * 3) + 1;
          const items = [];
          let totalAmount = 0;
          let totalProfit = 0;

          for (let k = 0; k < itemsCount; k++) {
            const item = menuItems[Math.floor(Math.random() * menuItems.length)];
            const qty = Math.floor(Math.random() * 3) + 1;
            const price = item.price;
            const costPrice = item.costPrice || (price * 0.4); // fallback cost price
            
            items.push({
              menuItemId: item._id,
              itemName: item.name,
              quantity: qty,
              price: price,
              costPrice: costPrice
            });

            totalAmount += price * qty;
            totalProfit += (price - costPrice) * qty;
          }

          const newTransaction = {
            locationId: loc._id,
            tableNumber: Math.floor(Math.random() * 20) + 1,
            staffId: staff._id,
            orders: items,
            totalAmount: totalAmount,
            totalProfit: totalProfit,
            date: date
          };

          transactions.push(newTransaction);

          // Also create an income expense for each transaction to sync with analytics
          expenses.push({
            title: `Revenue: Table ${newTransaction.tableNumber}`,
            description: `Seeded transaction record`,
            amount: totalAmount,
            profit: totalProfit,
            type: 'income',
            locationId: loc._id,
            createdBy: staff._id,
            date: date,
            proofImage: 'https://res.cloudinary.com/demo/image/upload/v1625055000/sample.jpg'
          });
        }
      });
    }

    await Transaction.insertMany(transactions);
    await Expense.insertMany(expenses);
    console.log(`Successfully seeded ${transactions.length} transactions and ${expenses.length} income entries across ${locations.length} locations.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedTransactions();
