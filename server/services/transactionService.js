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
    // Use expenseId for precise matching
    const existing = await Transaction.findOne({ expenseId: expense._id });

    if (existing) {
      existing.status = expense.status === 'approved' || expense.status === 'completed' ? 'approved' : 
                        expense.status === 'rejected' ? 'rejected' : 'pending';
      existing.totalAmount = expense.amount;
      existing.totalProfit = -expense.amount;
      existing.title = expense.title;
      existing.category = expense.category;
      existing.date = expense.date;
      return await existing.save();
    }

    return await this.createTransaction({
      locationId: expense.locationId,
      expenseId: expense._id,
      type: 'EXPENSE',
      source: 'MANUAL',
      title: expense.title,
      description: expense.description,
      category: expense.category,
      totalAmount: expense.amount,
      date: expense.date,
      billImage: expense.proofImage,
      status: expense.status === 'approved' || expense.status === 'completed' ? 'approved' : 
              expense.status === 'rejected' ? 'rejected' : 'pending',
      createdBy: expense.createdBy
    });
  }
}

module.exports = new TransactionService();
