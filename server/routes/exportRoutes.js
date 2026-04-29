const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const { generateCSV, generatePDF, generateExcel } = require('../utils/exportService');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');

// Models
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const Coupon = require('../models/Coupon');
const Attendance = require('../models/Attendance');

// @desc    Export Advanced Data
// @route   GET /api/export
router.get('/', verifyToken, authorizeRoles('admin', 'super_admin', 'branch_admin'), asyncHandler(async (req, res) => {
  const { type, format, startDate, endDate, branchId } = req.query;

  if (!type || !format) {
    res.status(400);
    throw new Error('Type and Format are mandatory');
  }

  const query = {};
  
  // Date Filtering
  if (startDate || endDate) {
    const dateField = type === 'attendance' ? 'date' : 'createdAt';
    query[dateField] = {};
    if (startDate) query[dateField].$gte = new Date(startDate);
    if (endDate) query[dateField].$lte = new Date(endDate);
  }

  // Branch Filtering
  if (req.user.role === 'branch_admin') {
    query.branch = req.user.assignedLocation;
    if (type === 'revenue') query.locationId = req.user.assignedLocation;
  } else if (branchId && branchId !== 'all') {
    query.branch = branchId;
    if (type === 'revenue') query.locationId = branchId;
  }

  let data = [];
  let exportTitle = `${type.toUpperCase()} REPORT`;

  switch (type.toLowerCase()) {
    case 'orders':
      const orders = await Order.find(query).populate('table', 'name').lean();
      data = orders.map(o => ({
        ID: o._id.toString().slice(-6),
        Date: o.createdAt,
        Table: o.table?.name || 'N/A',
        Total: o.totalAmount,
        Status: o.status,
        Customer: o.customerName || 'Walk-in',
        Items: o.items.map(i => `${i.itemName} (x${i.quantity})`).join(', ')
      }));
      break;

    case 'revenue':
      const txs = await Transaction.find(query).populate('locationId', 'name').lean();
      data = txs.map(t => ({
        Date: t.date,
        Branch: t.locationId?.name || 'Main',
        Type: t.type,
        Method: t.paymentMethod,
        Amount: t.totalAmount,
        Profit: t.totalProfit,
        Status: t.status
      }));
      break;

    case 'staff':
      const staffQuery = query.branch ? { assignedLocation: query.branch } : {};
      const users = await User.find(staffQuery).select('-password').populate('assignedLocation', 'name').lean();
      data = users.map(u => ({
        Name: u.name,
        Email: u.email,
        Phone: u.phone,
        Role: u.role,
        Branch: u.assignedLocation?.name || 'Unassigned',
        Status: u.active ? 'Active' : 'Inactive'
      }));
      break;

    case 'payroll':
      const payrolls = await Payroll.find(query).populate('user', 'name').populate('branch', 'name').lean();
      data = payrolls.map(p => ({
        Employee: p.user?.name,
        Month: p.month,
        Base: p.baseSalary,
        Bonuses: p.bonuses,
        Penalties: p.penalties,
        Net: p.netSalary,
        Status: p.status
      }));
      break;

    case 'attendance':
      const attendances = await Attendance.find(query).populate('user', 'name').lean();
      data = attendances.map(a => ({
        Date: a.date,
        Employee: a.user?.name,
        Status: a.status,
        CheckIn: a.checkIn,
        CheckOut: a.checkOut
      }));
      break;

    case 'coupons':
      const coupons = await Coupon.find(query).lean();
      data = coupons.map(c => ({
        Code: c.code,
        Type: c.discountType,
        Value: c.discountValue,
        MinOrder: c.minOrderAmount,
        Expiry: c.expiryDate,
        Used: c.usageCount,
        Active: c.isActive ? 'YES' : 'NO'
      }));
      break;

    default:
      res.status(400);
      throw new Error(`Export type '${type}' is not supported yet.`);
  }

  // Generate File
  const filename = `CafeOS_${type}_${new Date().toISOString().split('T')[0]}`;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
    return res.send(generateCSV(data));
  } else if (format === 'excel') {
    const buffer = await generateExcel(data, exportTitle);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
    return res.send(buffer);
  } else if (format === 'pdf') {
    const buffer = await generatePDF(data, exportTitle);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
    return res.send(buffer);
  } else {
    res.status(400);
    throw new Error('Unsupported format. Use csv, excel, or pdf.');
  }
}));

module.exports = router;
