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
    costPrice: {
      type: Number,
      default: 0,
      min: [0, 'Cost price cannot be negative'],
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
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Validate price is number (done by type)
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

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
module.exports = MenuItem;
