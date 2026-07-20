const mongoose = require('mongoose');
const Expense = require('./models/Expense');
const Transaction = require('./models/Transaction');
require('dotenv').config();

async function migrateExpenses() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB for migration...');

    const expenses = await Expense.find({});
    console.log(`Found ${expenses.length} expenses to migrate.`);

    for (const exp of expenses) {
      // Avoid duplicates
      const exists = await Transaction.findOne({ 
        title: exp.title, 
        totalAmount: exp.amount, 
        date: exp.date 
      });

      if (!exists) {
        const isIncome = exp.type === 'INCOME';
        // Map the expense's status onto the Transaction status enum
        // (['pending','approved','rejected']) so migrated rows are visible to the
        // P&L aggregations, which only count status: 'approved'.
        const status = ['approved', 'live', 'completed'].includes(exp.status)
          ? 'approved'
          : exp.status === 'rejected'
            ? 'rejected'
            : 'pending';
        await Transaction.create({
          type: isIncome ? 'MANUAL_REVENUE' : 'EXPENSE',
          status,
          totalAmount: exp.amount,
          totalProfit: exp.profit || (isIncome ? exp.amount : -exp.amount),
          title: exp.title,
          description: exp.description,
          category: exp.category || 'Legacy Migration',
          locationId: exp.locationId,
          date: exp.date,
          createdBy: exp.createdBy,
          billImage: exp.proofImage,
          createdAt: exp.createdAt,
          updatedAt: exp.updatedAt
        });
      }
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateExpenses();
