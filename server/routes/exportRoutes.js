const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const { generateCSV, generatePDF } = require('../utils/exportService');
const asyncHandler = require('../utils/asyncHandler');

// Models
const Expense = require('../models/Expense');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Reservation = require('../models/Reservation');

// @desc    Export data
// @route   GET /api/export
// @access  Private
router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const { type, format } = req.query;

  if (!type || !format) {
    res.status(400);
    throw new Error('Please provide both type and format parameters');
  }

  let Model;
  let data = [];
  let query = {};

  // Hierarchy Visibility Logic
  if (req.user.role === 'branch_admin') {
    query.locationId = req.user.assignedLocation;
    // For Users model, the field is assignedLocation
    if (type === 'users') {
      delete query.locationId;
      query.assignedLocation = req.user.assignedLocation;
      query.role = 'staff';
    }
  } else if (req.user.role === 'admin') {
    // Admin can see cross-location depending on the implementation
    // Generally they see everything accessible
    if (type === 'users') {
      query.role = { $in: ['branch_admin', 'staff'] };
    }
  } else if (req.user.role === 'super_admin') {
    // Super admin sees all
  }

  // Fetch data based on type
  switch (type.toLowerCase()) {
    case 'expenses':
      data = await Expense.find(query).lean();
      break;
    case 'users':
      data = await User.find(query).select('-password').lean();
      break;
    case 'menu':
      data = await MenuItem.find(query).lean();
      break;
    case 'reservations':
      data = await Reservation.find(query).lean();
      break;
    default:
      res.status(400);
      throw new Error('Invalid export type');
  }

  // Format the output
  if (format.toLowerCase() === 'csv') {
    const csvContent = generateCSV(data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_export.csv`);
    return res.send(csvContent);
  } else if (format.toLowerCase() === 'pdf') {
    const pdfBuffer = await generatePDF(data, `${type.toUpperCase()} EXPORT`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_export.pdf`);
    return res.send(pdfBuffer);
  } else {
    res.status(400);
    throw new Error('Invalid format. Use csv or pdf.');
  }
}));

module.exports = router;
