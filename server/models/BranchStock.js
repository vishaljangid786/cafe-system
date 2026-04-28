const mongoose = require('mongoose');

const branchStockSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups
branchStockSchema.index({ menuItem: 1, branch: 1 }, { unique: true });

const BranchStock = mongoose.model('BranchStock', branchStockSchema);
module.exports = BranchStock;
