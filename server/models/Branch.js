const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      unique: true,
      trim: true,
    },
    location: {
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['active', 'hold', 'deleted'],
      default: 'active',
    },
    holdReason: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPermanentlyDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

branchSchema.index({ status: 1 });

const Branch = mongoose.model('Branch', branchSchema);
module.exports = Branch;
