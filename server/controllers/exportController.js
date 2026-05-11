const mongoose = require('mongoose');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const Coupon = require('../models/Coupon');
const Attendance = require('../models/Attendance');
const BranchInventory = require('../models/BranchInventory');
const asyncHandler = require('../utils/asyncHandler');
const { generateCSV, generatePDF, generateExcel } = require('../utils/exportService');
const { userLocationIds, enforceLocationAccess } = require('../utils/accessControl');

/**
 * @desc    Export Advanced Data
 * @route   GET /api/export
 * @access  Private
 */
const exportData = asyncHandler(async (req, res) => {
  const { type, format, startDate, endDate, branchId } = req.query;

  if (!type || !format) {
    res.status(400);
    throw new Error('Type and Format are mandatory');
  }

  const exportType = type.toLowerCase();
  const query = {};
  
  // 1. Branch Filtering
  const branchField = ['revenue', 'attendance'].includes(exportType) ? 'locationId' : exportType === 'staff' ? 'assignedLocation' : 'branch';
  let finalBranchId = null;

  if (req.user.role === 'branch_admin' || req.user.role === 'staff' || req.user.role === 'chef') {
    finalBranchId = req.user.assignedLocation;
  } else if (branchId && branchId !== 'all') {
    enforceLocationAccess(req, res, branchId);
    finalBranchId = branchId;
  } else if (req.user.role === 'admin') {
    finalBranchId = { $in: userLocationIds(req.user) };
  }
  
  if (finalBranchId) {
    query[branchField] = finalBranchId;
  }

  // 2. Date Filtering
  if (startDate || endDate) {
    const dateField = exportType === 'attendance' ? 'date' : 'createdAt';
    query[dateField] = {};
    
    if (exportType === 'attendance') {
      if (startDate) query[dateField].$gte = startDate;
      if (endDate) query[dateField].$lte = endDate;
    } else {
      if (startDate) query[dateField].$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query[dateField].$lte = end;
      }
    }
  }

  let data = [];
  let exportTitle = `${exportType.toUpperCase()} REPORT`;

  switch (exportType) {
    case 'orders':
      const orders = await Order.find(query)
        .populate('table', 'name')
        .populate('items.menuItem', 'itemName')
        .lean();
        
      data = orders.map(o => ({
        ID: o._id.toString().slice(-6),
        Date: o.createdAt,
        Table: o.table?.name || 'N/A',
        Total: o.totalAmount,
        Status: o.status,
        Customer: o.customerName || 'Walk-in',
        Items: o.items.map(i => `${i.menuItem?.itemName || 'Unknown Item'} (x${i.quantity})`).join(', ')
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
      const staffQuery = query.assignedLocation ? { assignedLocation: query.assignedLocation } : {};
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
        Status: a.status
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
        Used: c.usedCount,
        Active: c.isActive ? 'YES' : 'NO'
      }));
      break;
      
    case 'inventory':
      const invItems = await BranchInventory.find(query)
        .populate('ingredient', 'name unit category')
        .populate('branch', 'name')
        .lean();
      data = invItems.map(i => ({
        Ingredient: i.ingredient?.name || 'Unknown',
        Branch: i.branch?.name || 'All',
        Stock: `${i.stock} ${i.ingredient?.unit || ''}`,
        Category: i.ingredient?.category || 'General',
        'Cost Per Unit': i.costPerUnit,
        'Min Threshold': i.minThreshold
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
});

module.exports = {
  exportData
};
