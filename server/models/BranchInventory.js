const mongoose = require('mongoose');

const branchInventorySchema = new mongoose.Schema(
  {
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ingredient',
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
    minThreshold: {
      type: Number,
      default: 10, // Default alert threshold
    },
    costPerUnit: {
      type: Number,
      default: 0,
    },
    lastRestocked: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Unique index to prevent duplicate ingredient entries per branch
branchInventorySchema.index({ ingredient: 1, branch: 1 }, { unique: true });

module.exports = mongoose.model('BranchInventory', branchInventorySchema);
