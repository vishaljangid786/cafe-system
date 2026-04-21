const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    tableNumber: {
      type: Number,
      required: true,
    },
    staffId: {
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
    billImage: String, // Archival proof
  },
  {
    timestamps: true,
  }
);

// Indexes for high-velocity analytics
transactionSchema.index({ locationId: 1, date: -1 });
transactionSchema.index({ 'orders.menuItemId': 1, date: -1 });
transactionSchema.index({ staffId: 1, date: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
