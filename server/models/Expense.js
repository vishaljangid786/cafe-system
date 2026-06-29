const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    profit: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      enum: ['EXPENSE', 'INCOME'],
      default: 'EXPENSE',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      default: 'misc',
    },
    // How the expense was paid. A CASH expense is paid out of the register, so it
    // reduces the cash drawer's expected balance; non-cash methods (UPI/card/etc.)
    // leave the physical cash untouched and are excluded from the drawer reconcile.
    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'CARD', 'ONLINE', 'OTHER'],
      default: 'CASH',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'live', 'completed'],
      default: 'pending',
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Location ID is required'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    proofImage: {
      type: String, // Cloudinary URL
      required: [true, 'Proof image is required'],
    },
  },
  {
    timestamps: true,
  }
);

expenseSchema.index({ locationId: 1, date: -1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ createdBy: 1 });
expenseSchema.index({ type: 1 });

const Expense = mongoose.model('Expense', expenseSchema);
module.exports = Expense;
