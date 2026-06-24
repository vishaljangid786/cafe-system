const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    type: {
      type: String,
      enum: ['REVENUE', 'POS_REVENUE', 'MANUAL_REVENUE', 'EXPENSE'],
      default: 'REVENUE',
      required: true,
    },
    source: {
      type: String,
      enum: ['ORDER', 'POS', 'MANUAL'],
      default: 'ORDER'
    },
    paymentType: {
      type: String,
      enum: ['CASH', 'UPI', 'CARD', 'ONLINE', 'GIFT_CARD', 'OTHER'],
      default: 'CASH',
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense'
    },
    title: {
      type: String,
      required: function() { return this.type !== 'POS_REVENUE'; }
    },
    description: String,
    category: {
      type: String,
      required: function() { return this.type !== 'POS_REVENUE'; }
    },
    tableNumber: {
      type: Number,
      required: function() { return this.type === 'POS_REVENUE'; }
    },
    customerName: String,
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function() { return this.type === 'POS_REVENUE'; }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orders: [
      {
        menuItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
        itemName: String,
        quantity: Number,
        price: Number,
        costPrice: {
          type: Number,
          default: 0,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    totalProfit: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    billImage: String, // Archival proof for POS or Receipt for Expense
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for high-velocity analytics
transactionSchema.index({ locationId: 1, type: 1, date: -1 });
transactionSchema.index({ 'orders.menuItemId': 1, date: -1 });
transactionSchema.index({ staffId: 1, date: -1 });
transactionSchema.index({ createdBy: 1, date: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ createdAt: -1 });

// Traceability lookups
transactionSchema.index({ orderId: 1 });
transactionSchema.index({ expenseId: 1 });

// Optimized analytics filtering
transactionSchema.index({ locationId: 1, status: 1, date: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
