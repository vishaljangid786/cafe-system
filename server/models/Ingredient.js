const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ingredient name is required'],
      unique: true,
      trim: true,
    },
    unit: {
      type: String,
      required: [true, 'Unit is required (e.g., kg, ltr, pcs)'],
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
    },
    baseCost: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ingredient', ingredientSchema);
