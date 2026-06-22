const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { encrypt, decrypt } = require('../utils/encryption');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^[0-9]{10}$/, 'Please add a valid 10-digit phone number'],
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: [true, 'Gender is required'],
    },
    age: {
      type: Number,
      min: [18, 'User must be at least 18 years old'],
      max: [99, 'Age cannot be more than 99'],
    },
    address1: {
      type: String,
      required: [true, 'Address Line 1 is required'],
    },
    address2: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City is required'],
    },
    state: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: 'India',
    },
    pincode: {
      type: String,
      match: [/^[0-9]{6}$/, 'Please add a valid 6-digit pincode'],
      default: '110001'
    },
    alternatePhone: {
      type: String,
      match: [/^[0-9]{10}$/, 'Please add a valid 10-digit phone number'],
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'],
      default: 'staff',
    },
    permissions: {
      viewRevenue: { type: Boolean, default: false },
      editRevenue: { type: Boolean, default: false },
      viewOrders: { type: Boolean, default: false },
      manageOrders: { type: Boolean, default: false },
      forceComplete: { type: Boolean, default: false },
      exportReports: { type: Boolean, default: false },
      manageStaff: { type: Boolean, default: false },
      manageNotifications: { type: Boolean, default: false },
      viewAnalytics: { type: Boolean, default: false },
      manageCoupons: { type: Boolean, default: false },
    },
    // For Staff and Branch Admin
    assignedLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: function() { return ['branch_admin', 'location_admin', 'staff', 'chef'].includes(this.role); },
    },
    // For Admins (Super/Global)
    accessibleLocations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
      }
    ],
    aadharNumber: {
      type: String,
      set: (val) => encrypt(val),
      get: (val) => decrypt(val),
      // Setters run BEFORE validators in Mongoose, so `val` here is the encrypted
      // string. Decrypt first, then check the 12-digit format. Skip when empty
      // (field is optional). A plain (unencrypted) value passes through decrypt
      // unchanged, so this also holds for non-encrypted input.
      validate: {
        validator: (val) => !val || /^[0-9]{12}$/.test(decrypt(val)),
        message: 'Please add a valid 12-digit Aadhar number',
      },
    },
    aadharImage: {
      type: String,
    },
    highestQualification: {
      type: String,
      enum: ['10th Pass', '12th Pass', 'Diploma', 'Graduate', 'Post Graduate'],
      default: '12th Pass'
    },
    monthlySalary: {
      type: Number,
      default: 0,
    },
    profileImageUrl: {
      type: String,
      default: "",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    sessionVersion: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.index({ role: 1 });
userSchema.index({ assignedLocation: 1 });
userSchema.index({ isBlocked: 1 });
// Hot path: notification recipient resolution joins role + branch
userSchema.index({ role: 1, assignedLocation: 1 });
// Hot path: admin lookups by accessibleLocations array
userSchema.index({ accessibleLocations: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
