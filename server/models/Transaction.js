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
      enum: ['REVENUE', 'pos_revenue', 'manual_revenue', 'expense'],
      default: 'REVENUE',
      required: true,
    },
    source: {
      type: String,
      enum: ['ORDER', 'POS', 'MANUAL'],
      default: 'ORDER'
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    title: {
      type: String,
      required: function() { return this.type !== 'pos_revenue'; }
    },
    description: String,
    category: {
      type: String,
      required: function() { return this.type !== 'pos_revenue'; }
    },
    tableNumber: {
      type: Number,
      required: function() { return this.type === 'pos_revenue'; }
    },
    customerName: String,
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function() { return this.type === 'pos_revenue'; }
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

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
