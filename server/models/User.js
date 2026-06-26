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
      // Normalize at the schema level so the unique index and all lookups agree on
      // casing. Without this, `Foo@x.com` and `foo@x.com` are distinct in the unique
      // index (duplicate accounts), and a mixed-case signup could never log in
      // because login always lower-cases the lookup.
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      // Matches the signup validator's 10-char minimum so non-signup paths
      // (admin-created users, resets, seed) can't store weaker passwords.
      minlength: [10, 'Password must be at least 10 characters'],
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
      // Page-access permissions: let an admin/super-admin delegate normally
      // role-locked pages (Users, Branches, Audit Logs, Impersonate) to any user.
      // Analytics pages (Branch Compare, Payment, Command Center, Forecast) are
      // unlocked by the existing viewAnalytics permission.
      manageBranches: { type: Boolean, default: false },
      viewAuditLogs: { type: Boolean, default: false },
      impersonateUsers: { type: Boolean, default: false },
      viewAdminCenter: { type: Boolean, default: false },
      manageGlobalMenu: { type: Boolean, default: false },
      sendGlobalNotifications: { type: Boolean, default: false },
      // Messaging permissions.
      // sendMessages: master switch — can this user send messages at all. ON by
      //   default so the role-based hierarchy works out of the box; turn it OFF to
      //   make the account receive-only.
      // messageSuperAdmin: lets a branch admin / staff / chef also message the
      //   super admin directly (their default target list does not include them).
      sendMessages: { type: Boolean, default: true },
      messageSuperAdmin: { type: Boolean, default: false },
    },
    // Page-level access — the authoritative list of dashboard pages this user may
    // open (keys from utils/pageAccess.js, e.g. 'page_salaries'). "One toggle = one
    // page": the sidebar and route guard read this. super_admin ignores it (sees
    // all). Existing users are backfilled from the legacy `permissions` on startup.
    allowedPages: {
      type: [String],
      default: [],
    },
    // Per-page ACTION access — the granular layer above allowedPages. A map of
    // `${scope}.${action}` (e.g. 'orders.add', 'revenue.approve') -> Boolean. See
    // utils/actionPermissions.js. Empty by default; ticking a key grants that exact
    // ability to this user even when their role normally couldn't (kept ALONGSIDE
    // the legacy broad `permissions`, never replacing them).
    actionPermissions: {
      type: Map,
      of: Boolean,
      default: () => ({}),
    },
    // Primary/default branch for Staff, Chef, Location Admin, and Branch Admin
    assignedLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: function() { return ['branch_admin', 'location_admin', 'staff', 'chef'].includes(this.role); },
    },
    // Branches managed by Admins and multi-branch Branch Admins
    accessibleLocations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
      }
    ],
    // Cafes (brands/organizations) this user administers. Many-to-many: an admin
    // may run several cafes, and a cafe may have several admins. Only meaningful
    // for the `admin` role — super_admin sees all cafes platform-wide, and
    // branch-level roles derive their cafe from assignedLocation.cafe. The branches
    // of every cafe listed here are kept mirrored into `accessibleLocations`, so
    // all existing per-branch scoping keeps working unchanged.
    cafes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cafe',
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
    // Per-account brute-force lockout
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    // Never serialize the password hash (or __v). This applies to EVERY response
    // that returns a user document, closing password-hash leaks app-wide.
    toJSON: {
      getters: true,
      transform: (doc, ret) => { delete ret.password; delete ret.__v; return ret; },
    },
    toObject: {
      getters: true,
      transform: (doc, ret) => { delete ret.password; delete ret.__v; return ret; },
    },
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
// Cafe membership lookups ("who administers this cafe").
userSchema.index({ cafes: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;
