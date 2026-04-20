const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Menu item name is required'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    originalPrice: {
      type: Number,
      min: [0, 'Original price cannot be negative'],
    },
    discountedPrice: {
      type: Number,
      min: [0, 'Discounted price cannot be negative'],
    },
    image: {
      type: String, // Cloudinary URL
    },
    description: {
      type: String,
      trim: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    preparationTime: {
      type: Number, // in minutes
      min: [0, 'Preparation time cannot be negative'],
      default: 10,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null, // null = global item visible to all locations
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validate discountedPrice < originalPrice
menuItemSchema.pre('save', function (next) {
  if (
    this.discountedPrice !== undefined &&
    this.originalPrice !== undefined &&
    this.discountedPrice >= this.originalPrice
  ) {
    const error = new Error('Discounted price must be less than original price');
    return next(error);
  }
  next();
});

// Index for fast filtering
menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ price: 1 });
menuItemSchema.index({ locationId: 1, isAvailable: 1 });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
module.exports = MenuItem;
