const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');
const sendNotification = require('../utils/sendNotification');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res, next) => {
  const {
    name, email, password, phone, gender, age,
    address1, address2, city, state, country,
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
  
  if (userCount > 0) {
    if (!creator) {
      res.status(401);
      throw new Error('Not authorized to register new personnel');
    }

    if (creator.role === 'location_admin') {
      if (role !== 'staff') {
        res.status(403);
        throw new Error('Location Admins can only register Staff members');
      }
      if (assignedLocation !== creator.assignedLocation.toString()) {
        res.status(403);
        throw new Error('Location Admins can only register staff for their own location');
      }
    } else if (creator.role === 'admin') {
      if (role === 'super_admin') {
        res.status(403);
        throw new Error('Admins cannot register Super Admins');
      }
    }
  } else {
    if (role !== 'super_admin') {
      res.status(400);
      throw new Error('The first user registered in the system must be a Super Admin');
    }
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  let aadharImage = '';
  if (req.file) {
    aadharImage = req.file.path;
  } else {
    res.status(400);
    throw new Error('Aadhar image is required');
  }

  const user = await User.create({
    name, email, password, phone, gender, age,
    address1, address2, city, state, country,
    alternatePhone, role, assignedLocation, accessibleLocations,
    aadharNumber, aadharImage, highestQualification, monthlySalary
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

  const user = await User.findOne({ email }).populate('assignedLocation accessibleLocations');

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

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate('assignedLocation accessibleLocations');

  if (user) {
    res.json({
      success: true,
      data: user,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

module.exports = {
  registerUser,
  loginUser,
  getProfile,
};
