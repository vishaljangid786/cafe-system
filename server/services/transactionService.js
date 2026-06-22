const Transaction = require('../models/Transaction');

class TransactionService {
  /**
   * Create a transaction in the ledger
   * @param {Object} data - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async createTransaction(data) {
    const {
      locationId,
      type,
      source,
      paymentType,
      orderId,
      expenseId,
      title,
      description,
      category,
      totalAmount,
      totalProfit,
      date,
      billImage,
      status,
      createdBy,
      staffId
    } = data;

    // Default profit calculation if not provided
    let calculatedProfit = totalProfit;
    if (calculatedProfit === undefined) {
      calculatedProfit = (type === 'EXPENSE') ? -totalAmount : totalAmount;
    }

    const transaction = await Transaction.create({
      locationId,
      type,
      source: source || 'MANUAL',
      paymentType: paymentType || (type === 'EXPENSE' ? 'CASH' : 'UPI'),
      orderId,
      expenseId, // persist the link so re-syncs UPDATE instead of duplicating
      title,
      description,
      category,
      totalAmount,
      totalProfit: calculatedProfit,
      date: date || new Date(),
      billImage,
      status: status || 'pending',
      createdBy,
      staffId
    });

    return transaction;
  }

  /**
   * Sync an Expense record to Transaction ledger
   * @param {Object} expense - Expense model instance
   * @returns {Promise<Object>} Created/Updated transaction
   */
  async deleteExpenseTransaction(expenseId) {
    await Transaction.deleteOne({ expenseId });
  }

  async syncExpenseToTransaction(expense) {
    // An Expense with type 'INCOME' (e.g. reservation income) must hit the ledger
    // as REVENUE with positive profit — NOT as an expense (which corrupted P&L).
    const isIncome = expense.type === 'INCOME';
    const txType = isIncome ? 'MANUAL_REVENUE' : 'EXPENSE';
    const txProfit = isIncome ? expense.amount : -expense.amount;
    const txStatus = expense.status === 'approved' || expense.status === 'completed' ? 'approved'
      : expense.status === 'rejected' ? 'rejected' : 'pending';

    const existing = await Transaction.findOne({ expenseId: expense._id });

    if (existing) {
      existing.status = txStatus;
      existing.type = txType;
      existing.totalAmount = expense.amount;
      existing.totalProfit = txProfit;
      existing.title = expense.title;
      existing.category = expense.category;
      existing.date = expense.date;
      return await existing.save();
    }

    return await this.createTransaction({
      locationId: expense.locationId,
      expenseId: expense._id,
      type: txType,
      source: 'MANUAL',
      title: expense.title,
      description: expense.description,
      category: expense.category,
      totalAmount: expense.amount,
      totalProfit: txProfit,
      date: expense.date,
      billImage: expense.proofImage,
      status: txStatus,
      createdBy: expense.createdBy
    });
  }
}

module.exports = new TransactionService();
