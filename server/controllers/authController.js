const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');
const sendNotification = require('../utils/sendNotification');
const { logActivity } = require('../utils/auditLogger');
const AuditLog = require('../models/AuditLog');

// Generate JWT
const generateToken = (id, sessionVersion, impersonatedBy = null, isViewOnly = false) => {
  const payload = { id, sessionVersion };
  if (impersonatedBy) {
    payload.impersonatedBy = impersonatedBy;
    payload.isViewOnly = isViewOnly;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Helper to set token in cookie and send response
const sendTokenResponse = (user, statusCode, res, impersonatedBy = null, isViewOnly = false) => {
  const token = generateToken(user._id, user.sessionVersion, impersonatedBy, isViewOnly);

  const cookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedLocation: user.assignedLocation,
        accessibleLocations: user.accessibleLocations,
        permissions: user.permissions
      }
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

  const userCount = await User.countDocuments();
  let finalRole = role;

  if (userCount === 0) {
    finalRole = 'super_admin';
  } else {
    // Standard auth middleware should have populated req.user
    const creator = req.user;
    
    if (!creator) {
      res.status(401);
      throw new Error('You do not have permission to add new staff');
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
      // Branch admin cannot set accessibleLocations
      req.body.accessibleLocations = [];
    } else if (creator.role === 'admin') {
      if (['super_admin', 'admin'].includes(role)) {
        res.status(403);
        throw new Error('Admins can only register Branch Admins and Staff');
      }
      // Admin can only assign locations they have permission for
      if (assignedLocation && !creator.accessibleLocations?.some(loc => loc.toString() === assignedLocation)) {
        res.status(403);
        throw new Error('You cannot assign a location you do not have permission for');
      }
      if (accessibleLocations?.length) {
        const hasUnauthorized = accessibleLocations.some(
          loc => !creator.accessibleLocations?.some(cloc => cloc.toString() === loc.toString())
        );
        if (hasUnauthorized) {
          res.status(403);
          throw new Error('You cannot grant permission for locations you do not manage');
        }
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
      title: 'New Staff Synced',
      message: `User ${user.name} (${user.role}) has been added to the matrix.`,
      type: 'user_action',
      performedByUser: user,
      locationId: user.assignedLocation,
    });

    await logActivity(
      req.user,
      'USER_REGISTER',
      `Added new staff: ${user.name} (${user.role})`,
      req,
      { targetUserId: user._id, role: user.role, locationId: user.assignedLocation }
    );

    sendTokenResponse(user, 201, res);
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

  const user = await User.findOne({ email: cleanEmail }).populate('assignedLocation accessibleLocations');

  if (user && (await user.matchPassword(password))) {
    sendTokenResponse(user, 200, res);
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
    throw new Error('Already logged in as another user');
  }

  if (req.user.role === 'chef' || req.user.role === 'staff') {
    res.status(403);
    throw new Error('You do not have permission to login as others');
  }

  const targetUser = await User.findById(req.params.userId).populate('assignedLocation accessibleLocations');

  if (!targetUser) {
    res.status(404);
    throw new Error('Target user not found');
  }
  
  // Hierarchical Security Check
  if (req.user.role === 'admin') {
    if (targetUser.role === 'super_admin') {
      res.status(403);
      throw new Error('Admins cannot assume the identity of a Super Admin');
    }
    
    // Cross-Branch Impersonation Prevention
    if (targetUser.assignedLocation) {
      const targetLocId = targetUser.assignedLocation._id?.toString() || targetUser.assignedLocation.toString();
      const hasAccess = req.user.accessibleLocations?.some(loc => loc.toString() === targetLocId);
      
      if (!hasAccess) {
        res.status(403);
        throw new Error('You can only assume identities within your managed branches');
      }
    }
  }
  
  if (req.user.role === 'branch_admin') {
    if (['super_admin', 'admin', 'branch_admin'].includes(targetUser.role)) {
      res.status(403);
      throw new Error('Branch Managers can only assume the identity of lower-level staff');
    }
    
    if (targetUser.assignedLocation.toString() !== req.user.assignedLocation.toString()) {
      res.status(403);
        throw new Error('You can only login as staff in your own branch');
    }
  }

  const { viewOnly } = req.body;

  await AuditLog.create({
    action: 'IMPERSONATION_START',
    performedBy: req.user._id,
    targetUser: targetUser._id,
    details: `Admin ${req.user.name} logged in as ${targetUser.name} [Mode: ${viewOnly ? 'VIEW-ONLY' : 'FULL-CONTROL'}]`,
    role: req.user.role
  });

  sendTokenResponse(targetUser, 200, res, req.user._id, Boolean(viewOnly));
});

// @desc    Exit impersonation
// @route   POST /api/auth/exit-impersonation
// @access  Private
const exitImpersonation = asyncHandler(async (req, res, next) => {
  if (!req.impersonator) {
    res.status(400);
    throw new Error('Not currently impersonating anyone');
  }

  const originalUser = await User.findById(req.impersonator._id).populate('assignedLocation accessibleLocations');

  if (!originalUser) {
    res.status(404);
    throw new Error('Original admin user not found');
  }

  await AuditLog.create({
    action: 'IMPERSONATION_EXIT',
    performedBy: req.user._id,
    details: `Admin ${originalUser.name} exited impersonation`,
    role: req.user.role
  });

  sendTokenResponse(originalUser, 200, res);
});

// @desc    Logout user / clear cookie
// @route   GET /api/auth/logout
// @access  Private
const logoutUser = asyncHandler(async (req, res, next) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('assignedLocation accessibleLocations');

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

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getProfile,
  impersonateUser,
  exitImpersonation,
};
