const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedChef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    items: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'Quantity cannot be less than 1'],
        },
        notes: {
          type: String,
        },
      },
    ],
    status: {
      type: String,
      enum: [
        'PLACED',
        'ACCEPTED',
        'PREPARING',
        'READY',
        'SERVED',
        'COMPLETED',
        'CANCELLED',
        'REJECTED',
      ],
      default: 'PLACED',
      index: true,
    },
    isBilled: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
    chefNote: {
      type: String,
    },
    rejectReason: {
      type: String,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }
    ]
  },
  {
    timestamps: true,
  }
);

// Index for createdAt as requested
orderSchema.index({ createdAt: -1 });
orderSchema.index({ createdBy: 1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
