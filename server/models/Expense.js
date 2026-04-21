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
    },
    profit: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      enum: ['expense', 'income'],
      default: 'expense',
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

const Expense = mongoose.model('Expense', expenseSchema);
module.exports = Expense;
