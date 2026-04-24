const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');
const sendNotification = require('../utils/sendNotification');
const AuditLog = require('../models/AuditLog');

// Generate JWT
const generateToken = (id, impersonatedBy = null, isViewOnly = false) => {
  const payload = { id };
  if (impersonatedBy) {
    payload.impersonatedBy = impersonatedBy;
    payload.isViewOnly = isViewOnly;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res, next) => {
  const {
    name, email, password, phone, gender, age,
    address1, address2, city, state, country, pincode,
    alternatePhone, role, assignedLocation, accessibleLocations,
    aadharNumber, highestQualification, monthlySalary
  } = req.body;

  let creator = null;
  const token = req.headers.authorization?.startsWith('Bearer') ? req.headers.authorization.split(' ')[1] : null;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      creator = await User.findById(decoded.id);
    } catch (err) {}
  }

  const userCount = await User.countDocuments();
  let finalRole = role;

  if (userCount === 0) {
    finalRole = 'super_admin';
  } else {
    if (!creator) {
      res.status(401);
      throw new Error('Not authorized to register new personnel');
    }

    if (creator.role === 'branch_admin') {
      if (role !== 'staff') {
        res.status(403);
        throw new Error('Branch Admins can only register Staff members');
      }
      if (assignedLocation !== creator.assignedLocation.toString()) {
        res.status(403);
        throw new Error('Branch Admins can only register staff for their own location');
      }
    } else if (creator.role === 'admin') {
      if (role === 'super_admin') {
        res.status(403);
        throw new Error('Admins cannot register Super Admins');
      }
    }
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  let aadharImage = '';
  let profileImageUrl = '';

  if (req.files) {
    if (req.files.aadharImage) aadharImage = req.files.aadharImage[0].path;
    if (req.files.profileImage) profileImageUrl = req.files.profileImage[0].path;
  }

  const user = await User.create({
    name, email, password, phone, gender, age,
    address1, address2, city, state, country, pincode,
    alternatePhone, role: finalRole, assignedLocation, accessibleLocations,
    aadharNumber, aadharImage, profileImageUrl, highestQualification, monthlySalary
  });

  if (user) {
    await sendNotification({
      title: 'New Personnel Synced',
      message: `User ${user.name} (${user.role}) has been added to the matrix.`,
      type: 'user_action',
      performedByUser: user,
      locationId: user.assignedLocation,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      }
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const cleanEmail = email.trim().toLowerCase();
  console.log(cleanEmail, password);

  const user = await User.findOne({ email: cleanEmail }).populate('assignedLocation accessibleLocations');

  if (user && (await user.matchPassword(password))) {
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedLocation: user.assignedLocation,
        accessibleLocations: user.accessibleLocations,
        token: generateToken(user._id),
      }
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Impersonate another user
// @route   POST /api/auth/impersonate/:userId
// @access  Private (Super Admin)
const impersonateUser = asyncHandler(async (req, res, next) => {
  if (req.impersonator) {
    res.status(403);
    throw new Error('Cannot impersonate while already impersonating');
  }

  if (req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error('Only Super Admins can impersonate users');
  }

  const targetUser = await User.findById(req.params.userId).populate('assignedLocation accessibleLocations');

  if (!targetUser) {
    res.status(404);
    throw new Error('Target user not found');
  }

  const { viewOnly } = req.body;

  console.log(`[AUDIT] Super Admin ${req.user._id} (${req.user.email}) initiated impersonation of User ${targetUser._id} (${targetUser.email}) [Mode: ${viewOnly ? 'VIEW-ONLY' : 'FULL-ACCESS'}]`);

  // Record Audit Log
  await AuditLog.create({
    action: 'IMPERSONATION_START',
    performedBy: req.user._id,
    targetUser: targetUser._id,
    details: `Super Admin impersonated ${targetUser.name} (${targetUser.role}) in ${viewOnly ? 'VIEW-ONLY' : 'FULL-ACCESS'} mode`,
    ipAddress: req.ip
  });

  res.json({
    success: true,
    data: {
      _id: targetUser._id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      assignedLocation: targetUser.assignedLocation,
      accessibleLocations: targetUser.accessibleLocations,
      impersonatedBy: req.user._id,
      isViewOnly: !!viewOnly,
      token: generateToken(targetUser._id, req.user._id, !!viewOnly),
    }
  });
});

// @desc    Exit impersonation
// @route   POST /api/auth/exit-impersonation
// @access  Private
const exitImpersonation = asyncHandler(async (req, res, next) => {
  if (!req.impersonator) {
    res.status(400);
    throw new Error('Not currently impersonating anyone');
  }

  const originalAdmin = await User.findById(req.impersonator._id).populate('assignedLocation accessibleLocations');

  if (!originalAdmin) {
    res.status(404);
    throw new Error('Original admin user not found');
  }

  console.log(`[AUDIT] Super Admin ${originalAdmin._id} (${originalAdmin.email}) exited impersonation`);

  // Record Audit Log
  await AuditLog.create({
    action: 'IMPERSONATION_EXIT',
    performedBy: originalAdmin._id,
    details: 'Super Admin exited impersonation mode',
    ipAddress: req.ip
  });

  res.json({
    success: true,
    data: {
      _id: originalAdmin._id,
      name: originalAdmin.name,
      email: originalAdmin.email,
      role: originalAdmin.role,
      assignedLocation: originalAdmin.assignedLocation,
      accessibleLocations: originalAdmin.accessibleLocations,
      token: generateToken(originalAdmin._id),
    }
  });
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate('assignedLocation accessibleLocations');

  if (user) {
    const userData = user.toObject();
    if (req.impersonator) {
      userData.impersonatedBy = req.impersonator;
    }

    res.json({
      success: true,
      data: userData,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Check if any users exist for initial setup
// @route   GET /api/auth/initial-setup-check
// @access  Public
const initialSetupCheck = asyncHandler(async (req, res, next) => {
  const userCount = await User.countDocuments();
  res.json({
    success: true,
    data: {
      isInitialSetup: userCount === 0
    }
  });
});

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  impersonateUser,
  exitImpersonation,
  initialSetupCheck,
};
