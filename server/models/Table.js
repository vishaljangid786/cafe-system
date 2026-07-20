const mongoose = require('mongoose');
const crypto = require('crypto');

const orderItemSchema = new mongoose.Schema({
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    default: null, // null for manually entered items
  },
  itemName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  costPrice: {
    type: Number,
    default: 0,
  },
});

const tableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: Number,
      required: [true, 'Table number is required'],
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Location ID is required'],
    },
    tableName: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      default: 1,
      min: [1, 'Capacity must be at least 1'],
    },
    isBooked: {
      type: Boolean,
      default: false,
    },
    numberOfPeople: {
      type: Number,
      default: 0,
    },
    customerName: {
      type: String,
      trim: true,
    },
    // Captured alongside the name when the table session starts, so POS orders
    // carry a CRM identity (rewards + new-customer offer) the way QR orders do.
    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    orders: [orderItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
    },
    activeOrdersCount: {
      type: Number,
      default: 0,
    },
    appliedCoupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    status: {
      type: String,
      enum: ['available', 'booked', 'ongoing', 'completed'],
      default: 'available',
    },
    billImage: {
      type: String, // Cloudinary URL
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    publicOrderToken: {
      type: String,
      default: () => crypto.randomBytes(16).toString('hex'),
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure tableNumber is unique per location
tableSchema.index({ tableNumber: 1, locationId: 1 }, { unique: true });
// Index for analytics
tableSchema.index({ locationId: 1, status: 1, createdAt: -1 });

const Table = mongoose.model('Table', tableSchema);
module.exports = Table;
