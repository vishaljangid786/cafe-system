const mongoose = require('mongoose');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const Coupon = require('../models/Coupon');
const Attendance = require('../models/Attendance');
const BranchInventory = require('../models/BranchInventory');
const Reservation = require('../models/Reservation');
const Booking = require('../models/Booking');
const Expense = require('../models/Expense');
const asyncHandler = require('../utils/asyncHandler');
const { generateCSV, generatePDF, generateExcel } = require('../utils/exportService');
const { userLocationIds, enforceLocationAccess, scopedLocationIds } = require('../utils/accessControl');

/**
 * @desc    Export Advanced Data
 * @route   GET /api/export
 * @access  Private
 */
const exportData = asyncHandler(async (req, res) => {
  const { type, format, startDate, endDate, branchId, locationIds } = req.query;

  if (!type || !format) {
    res.status(400);
    throw new Error('Type and Format are mandatory');
  }

  const exportType = type.toLowerCase();
  const query = {};
  
  // 1. Branch Filtering
  const branchField = ['revenue', 'attendance'].includes(exportType) ? 'locationId' : exportType === 'staff' ? 'assignedLocation' : 'branch';
  let finalBranchId = null;

  if (locationIds) {
    // Multi-branch subset export
    const multi = scopedLocationIds(req, locationIds);
    if (multi) finalBranchId = multi;
  } else if (branchId && branchId !== 'all') {
    enforceLocationAccess(req, res, branchId);
    finalBranchId = branchId;
  } else if (['admin', 'branch_admin', 'location_admin'].includes(req.user.role)) {
    finalBranchId = { $in: userLocationIds(req.user) };
  } else if (req.user.role === 'staff' || req.user.role === 'chef') {
    finalBranchId = req.user.assignedLocation;
  } else if (req.user.role !== 'super_admin') {
    // Fail closed for any other non-super role rather than exporting all branches.
    finalBranchId = req.user.assignedLocation || { $in: [] };
  }
  
  if (finalBranchId) {
    query[branchField] = finalBranchId;
  }

  // 2. Date Filtering
  if (startDate || endDate) {
    // attendance stores a string `date`; ledger collections (revenue/expenses) use the
    // economic `date` field rather than the row's createdAt timestamp.
    const usesDateField = ['attendance', 'revenue', 'expenses'].includes(exportType);
    const dateField = usesDateField ? 'date' : 'createdAt';
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
        .populate('table', 'tableNumber tableName')
        .lean();

      data = orders.map(o => ({
        ID: o._id.toString().slice(-6),
        Date: o.createdAt,
        Table: o.table?.tableName || o.table?.tableNumber || 'N/A',
        Total: o.totalAmount,
        Status: o.status,
        Customer: o.customerName || 'Walk-in',
        Items: o.items.map(i => `${i.itemName || 'Unknown Item'} (x${i.quantity})`).join(', ')
      }));
      break;

    case 'revenue': {
      // Revenue export must only contain approved revenue rows — exclude EXPENSE
      // transactions and pending/rejected entries.
      const revenueQuery = {
        ...query,
        type: { $in: ['REVENUE', 'POS_REVENUE', 'MANUAL_REVENUE'] },
        status: 'approved'
      };
      const txs = await Transaction.find(revenueQuery).populate('locationId', 'name').lean();
      data = txs.map(t => ({
        Date: t.date,
        Branch: t.locationId?.name || 'Main',
        Type: t.type,
        Method: t.paymentType,
        Amount: t.totalAmount,
        Profit: t.totalProfit,
        Status: t.status
      }));
      break;
    }

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

    case 'payroll': {
      const payrollUserQuery = finalBranchId ? { assignedLocation: finalBranchId } : {};
      const payrollUsers = await User.find(payrollUserQuery).select('_id').lean();
      const payrollUserIds = payrollUsers.map(u => u._id);
      const payrollFilter = { user: { $in: payrollUserIds } };
      if (req.query.startDate) payrollFilter.month = { $gte: req.query.startDate.slice(0, 7) };
      if (req.query.endDate) {
        payrollFilter.month = { ...(payrollFilter.month || {}), $lte: req.query.endDate.slice(0, 7) };
      }
      const payrolls = await Payroll.find(payrollFilter)
        .populate('user', 'name assignedLocation')
        .lean();
      data = payrolls.map(p => ({
        Employee: p.user?.name,
        Month: p.month,
        Base: p.baseSalary,
        Bonuses: (p.bonuses?.topSeller || 0) + (p.bonuses?.performance || 0) + (p.bonuses?.extraShifts || 0),
        Penalties: (p.penalties?.lateMark || 0) + (p.penalties?.absent || 0) + (p.penalties?.leave || 0),
        Net: p.netSalary,
        Status: p.status
      }));
      break;
    }

    case 'attendance':
      const attendances = await Attendance.find(query).populate('user', 'name').lean();
      data = attendances.map(a => ({
        Date: a.date,
        Employee: a.user?.name,
        Status: a.status
      }));
      break;

    case 'coupons':
      // NOTE: The Coupon model has no branch/location field (coupons are global by design),
      // so there is no branch attribute to scope by. Left unscoped intentionally. If coupons
      // become branch-scoped, add the scope filter here. (See finding C4-5, deferred.)
      const coupons = await Coupon.find({}).lean();
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

    case 'reservations': {
      // Reservations use `locationId` not `branch`
      const resQuery = {};
      if (finalBranchId) resQuery.locationId = finalBranchId;
      if (query.createdAt) resQuery.date = query.createdAt; // map date range to `date` field
      const reservations = await Reservation.find(resQuery)
        .populate('locationId', 'name')
        .lean();
      data = reservations.map(r => ({
        ID: r._id.toString().slice(-6),
        Event: r.eventName,
        Type: r.reservationType,
        Location: r.locationId?.name,
        Date: r.date,
        Start: r.startTime,
        End: r.endTime,
        Customer: r.customerName,
        Phone: r.customerPhone,
        Amount: r.totalAmount,
        Status: r.status
      }));
      break;
    }

    case 'bookings': {
      // Bookings use `locationId`
      const bookQuery = {};
      if (finalBranchId) bookQuery.locationId = finalBranchId;
      if (query.createdAt) bookQuery.createdAt = query.createdAt;
      const bookings = await Booking.find(bookQuery).lean();
      data = bookings.map(b => ({
        ID: b._id.toString().slice(-6),
        Guest: b.guestName || b.userId?.toString(),
        Email: b.guestEmail,
        Phone: b.guestPhone,
        Date: b.date,
        Start: b.startTime,
        End: b.endTime,
        Guests: b.numberOfGuests,
        Status: b.status
      }));
      break;
    }

    case 'expenses': {
      // Expenses use `locationId`, not `branch`, and filter on the economic `date` field.
      const expQuery = {};
      if (finalBranchId) expQuery.locationId = finalBranchId;
      if (query.date) expQuery.date = query.date;
      const expenses = await Expense.find(expQuery).lean();
      data = expenses.map(e => ({
        ID: e._id.toString().slice(-6),
        Date: e.date,
        Category: e.category,
        Amount: e.amount,
        Description: e.description,
        Status: e.status
      }));
      break;
    }

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
