const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const TransactionService = require('../services/transactionService');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const migrateExpenses = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for Migration');

    const expenses = await Expense.find({
      status: { $in: ['approved', 'completed'] }
    });

    console.log(`Found ${expenses.length} expenses to sync`);

    let syncedCount = 0;
    for (const expense of expenses) {
      await TransactionService.syncExpenseToTransaction(expense);
      syncedCount++;
      if (syncedCount % 10 === 0) console.log(`Synced ${syncedCount} expenses...`);
    }

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateExpenses();
