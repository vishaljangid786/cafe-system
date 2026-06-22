const Table = require('../models/Table');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { getIO } = require('../config/socket');
const { enforceLocationAccess, scopedLocationId } = require('../utils/accessControl');

const Order = require('../models/Order');

// @desc    Get all tables for a location
// @route   GET /api/tables
// @access  Private
const getTables = asyncHandler(async (req, res) => {
  let query = {};
  const { locationId } = req.query;

  // Enforce access control
  if (['branch_admin', 'admin'].includes(req.user.role)) {
    const branchScope = scopedLocationId(req, locationId);
    if (branchScope) query.locationId = branchScope;
  } else if (['staff', 'chef', 'location_admin'].includes(req.user.role)) {
    query.locationId = req.user.assignedLocation;
  }

  const tables = await Table.find(query)
    .populate('locationId', 'name city')
    .populate('orders.menuItemId', 'name image price category');

  // Aggregated data for frontend indicators
  const tablesWithIndicators = await Promise.all(tables.map(async (table) => {
    const tableObj = table.toObject();
    // Check if any active (non-completed) orders for this table have notes
    const activeOrdersWithNotes = await Order.exists({
      table: table._id,
      status: { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      chefNote: { $exists: true, $ne: '' }
    });
    tableObj.hasActiveNotes = !!activeOrdersWithNotes;
    return tableObj;
  }));

  res.json({
    success: true,
    count: tables.length,
    data: tablesWithIndicators,
  });
});

// @desc    Create/Add a table
// @route   POST /api/tables
// @access  Private (Admin, Branch Admin)
const addTable = asyncHandler(async (req, res) => {
  const { tableNumber, locationId, tableName, capacity } = req.body;
  
  let finalLocationId = locationId;

  if (!finalLocationId && (req.user.role === 'branch_admin' || req.user.role === 'staff')) {
    finalLocationId = req.user.assignedLocation;
  }

  if (!finalLocationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  enforceLocationAccess(req, res, finalLocationId, 'You do not have permission to add tables for this location');

  const tableExists = await Table.findOne({ tableNumber, locationId: finalLocationId });
  if (tableExists) {
    res.status(400);
    throw new Error('Table already exists in this location');
  }

  const table = await Table.create({
    tableNumber,
    tableName,
    capacity,
    locationId: finalLocationId,
    createdBy: req.user._id,
  });

  await sendNotification({
    title: 'New Table Operational',
    message: `Table ${table.tableName || table.tableNumber} added to the grid by ${req.user.name}.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: table.locationId,
  });

  const io = getIO();
  io.to(`branch_${table.locationId}`).emit('table:update', { tableId: table._id, action: 'add' });

  res.status(201).json({
    success: true,
    data: table,
  });
});

// @desc    Book a table
// @route   PUT /api/tables/:id/book
// @access  Private
const bookTable = asyncHandler(async (req, res) => {
  const { numberOfPeople } = req.body;
  const table = await Table.findById(req.params.id);

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  enforceLocationAccess(req, res, table.locationId, 'You do not have permission to book tables from other locations');

  if (table.isBooked) {
    res.status(400);
    throw new Error('Table is already occupied');
  }

  table.isBooked = true;
  table.numberOfPeople = Number(req.body.numberOfPeople) || table.capacity || 1;
  table.customerName = req.body.customerName || '';
  table.status = 'booked';
  
  await table.save();

  await sendNotification({
    title: 'Table Occupied',
    message: `Table ${table.tableNumber} engaged for ${numberOfPeople} souls by ${req.user.name}.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: table.locationId,
  });

  const io = getIO();
  io.to(`branch_${table.locationId}`).emit('table:update', { tableId: table._id, action: 'book' });

  res.json({
    success: true,
    data: table,
  });
});

// @desc    Add/Update orders for a table
// @route   PUT /api/tables/:id/orders
// @access  Private
const updateOrders = asyncHandler(async (req, res) => {
  const { orders } = req.body;
  const table = await Table.findById(req.params.id);

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  enforceLocationAccess(req, res, table.locationId, 'You do not have permission to update tables from other locations');

  table.orders = orders;
  table.totalAmount = orders.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  
  if (req.body.customerName !== undefined) table.customerName = req.body.customerName;
  if (req.body.numberOfPeople !== undefined) table.numberOfPeople = Number(req.body.numberOfPeople);

  table.status = 'ongoing';

  await table.save();

  await sendNotification({
    title: 'Orders Synchronized',
    message: `Table ${table.tableNumber} orders updated. Fiscal impact: ₹${table.totalAmount}.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: table.locationId,
  });

  const io = getIO();
  io.to(`branch_${table.locationId}`).emit('table:update', { tableId: table._id, action: 'order' });

  res.json({
    success: true,
    data: table,
  });
});

// @desc    Get single table
// @route   GET /api/tables/:id
// @access  Private
const getTable = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id)
    .populate('locationId', 'name city')
    .populate('orders.menuItemId', 'name image price category');

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  enforceLocationAccess(req, res, table.locationId, 'You do not have permission to view tables from other locations');

  res.json({
    success: true,
    data: table,
  });
});

// @desc    Upload bill image and mark as completed
// @route   PUT /api/tables/:id/bill
// @access  Private
const uploadBill = asyncHandler(async (req, res) => {
  const Expense = require('../models/Expense');
  const Order = require('../models/Order');
  const table = await Table.findById(req.params.id);

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  enforceLocationAccess(req, res, table.locationId, 'You do not have permission to upload bills for other locations');

  if (!req.file) {
    res.status(400);
    throw new Error('Fiscal proof (bill image) is required');
  }

  table.billImage = req.file.path;
  table.status = 'completed';

  // Finalize all associated orders to trigger revenue recording
  const sessionOrders = await Order.find({ 
    table: table._id, 
    status: { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] } 
  }).populate('items.menuItem');
  
  const { finalizeOrder } = require('../utils/orderFinalizer');
  
  for (const order of sessionOrders) {
    try {
      await finalizeOrder(order, req.user);
    } catch (err) {
      console.error(`Order ${order._id} finalization failed:`, err.message);
    }
  }


  // Reset table
  table.isBooked = false;
  table.status = 'available';
  table.orders = [];
  table.totalAmount = 0;
  table.numberOfPeople = 0;
  table.customerName = '';
  
  await table.save();

  await sendNotification({
    title: 'Session Saved',
    message: `Table ${table.tableNumber} session closed. Bill saved to history.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: table.locationId,
  });

  const io = getIO();
  io.to(`branch_${table.locationId}`).emit('table:update', { tableId: table._id, action: 'bill' });

  res.json({
    success: true,
    data: table,
  });
});

// @desc    Delete a table
// @route   DELETE /api/tables/:id
// @access  Private
const deleteTable = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id);

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  enforceLocationAccess(req, res, table.locationId, 'You do not have permission to delete tables from other locations');

  await table.deleteOne();

  const io = getIO();
  io.to(`branch_${table.locationId}`).emit('table:update', { tableId: table._id, action: 'delete' });

  res.json({
    success: true,
    message: 'Table removed from the matrix',
  });
});

// @desc    Complete order manually
// @route   PUT /api/tables/:id/complete
// @access  Private
const completeOrder = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id);

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  enforceLocationAccess(req, res, table.locationId, 'You do not have permission to complete tables from other locations');

  table.status = 'available';
  table.isBooked = false;
  table.orders = [];
  table.totalAmount = 0;
  table.numberOfPeople = 0;
  
  await table.save();

  const io = getIO();
  io.to(`branch_${table.locationId}`).emit('table:update', { tableId: table._id, action: 'complete' });

  res.json({
    success: true,
    data: table,
  });
});

// @desc    Update table details
// @route   PUT /api/tables/:id
// @access  Private (Admin, Branch Admin)
const updateTable = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id);

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  enforceLocationAccess(req, res, table.locationId, 'You do not have permission to update tables from other locations');

  const { locationId: _stripped, ...safeBody } = req.body;
  const updatedTable = await Table.findByIdAndUpdate(req.params.id, safeBody, {
    new: true,
    runValidators: true,
  });

  const io = getIO();
  io.to(`branch_${updatedTable.locationId}`).emit('table:update', { tableId: updatedTable._id, action: 'update' });

  res.json({
    success: true,
    data: updatedTable,
  });
});

module.exports = {
  getTables,
  getTable,
  addTable,
  bookTable,
  updateOrders,
  uploadBill,
  deleteTable,
  completeOrder,
  updateTable,
};
