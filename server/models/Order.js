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
    customerPhone: {
      type: String,
      default: null,
      index: true
    },
    customerName: {
      type: String,
      default: null
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
    paymentType: {
      type: String,
      enum: ['CASH', 'CARD', 'UPI', 'ONLINE'],
      default: 'CASH',
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
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

// Index for analytical and dashboard capabilities
orderSchema.index({ createdAt: -1 });
orderSchema.index({ createdBy: 1 });
orderSchema.index({ assignedChef: 1 });
orderSchema.index({ servedBy: 1 });
orderSchema.index({ paymentType: 1 });

orderSchema.query.byBranch = function(branchId) {
  return this.where({ branch: branchId });
};

orderSchema.query.active = function() {
  return this.where({ status: { $nin: ['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'] } });
};

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
