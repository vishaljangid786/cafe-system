const Table = require('../models/Table');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');

// @desc    Get all tables for a location
// @route   GET /api/tables
// @access  Private
const getTables = asyncHandler(async (req, res) => {
  let query = {};
  const { locationId } = req.query;

  if (locationId) {
    query.locationId = locationId;
  }

  // Enforce access control
  if (req.user.role === 'location_admin' || req.user.role === 'staff') {
    query.locationId = req.user.assignedLocation;
  } else if (req.user.role === 'admin' && req.user.accessibleLocations?.length > 0) {
    // If admin is requesting a specific location, check if they have access
    if (locationId && !req.user.accessibleLocations.includes(locationId)) {
      res.status(403);
      throw new Error('Not authorized to access this location');
    }
  }

  const tables = await Table.find(query)
    .populate('locationId', 'name city')
    .populate('orders.menuItemId', 'name image price category');

  res.json({
    success: true,
    count: tables.length,
    data: tables,
  });
});

// @desc    Create/Add a table
// @route   POST /api/tables
// @access  Private (Admin, Location Admin)
const addTable = asyncHandler(async (req, res) => {
  let { tableNumber, locationId } = req.body;

  if (!locationId && (req.user.role === 'location_admin' || req.user.role === 'staff')) {
    locationId = req.user.assignedLocation;
  }

  if (!locationId) {
    res.status(400);
    throw new Error('Location ID is required');
  }

  const tableExists = await Table.findOne({ tableNumber, locationId });
  if (tableExists) {
    res.status(400);
    throw new Error('Table already exists in this location');
  }

  const table = await Table.create({
    tableNumber,
    locationId,
    createdBy: req.user._id,
  });

  await sendNotification({
    title: 'New Table Operational',
    message: `Table ${table.tableNumber} added to the grid by ${req.user.name}.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: table.locationId,
  });

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

  if (table.isBooked) {
    res.status(400);
    throw new Error('Table is already occupied');
  }

  table.isBooked = true;
  table.numberOfPeople = numberOfPeople;
  table.status = 'booked';
  
  await table.save();

  await sendNotification({
    title: 'Table Occupied',
    message: `Table ${table.tableNumber} engaged for ${numberOfPeople} souls by ${req.user.name}.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: table.locationId,
  });

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

  table.orders = orders;
  table.totalAmount = orders.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  table.status = 'ongoing';

  await table.save();

  await sendNotification({
    title: 'Orders Synchronized',
    message: `Table ${table.tableNumber} orders updated. Fiscal impact: ₹${table.totalAmount}.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: table.locationId,
  });

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

  if (req.user.role === 'location_admin' && table.locationId.toString() !== req.user.assignedLocation.toString()) {
    res.status(403);
    throw new Error('Not authorized to view tables from other locations');
  }

  res.json({
    success: true,
    data: table,
  });
});

// @desc    Upload bill image and mark as completed
// @route   PUT /api/tables/:id/bill
// @access  Private
const uploadBill = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id);
  const Expense = require('../models/Expense');

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  if (!req.file) {
    res.status(400);
    throw new Error('Fiscal proof (bill image) is required');
  }

  table.billImage = req.file.path;
  table.status = 'completed';

  const Transaction = require('../models/Transaction');

  const totalProfit = table.orders.reduce((acc, item) => {
    return acc + ((Number(item.price) - Number(item.costPrice || 0)) * Number(item.quantity));
  }, 0);

  // Archive session as a persistent Transaction
  await Transaction.create({
    locationId: table.locationId,
    tableNumber: table.tableNumber,
    staffId: req.user._id,
    orders: table.orders.map(o => ({
      menuItemId: o.menuItemId,
      itemName: o.itemName,
      quantity: o.quantity,
      price: o.price,
      costPrice: o.costPrice || 0
    })),
    totalAmount: table.totalAmount,
    totalProfit: totalProfit,
    billImage: req.file.path,
    date: new Date()
  });

  await Expense.create({
    title: `Revenue: Table ${table.tableNumber}`,
    description: `Automated fiscal entry from table completion. \nOrders:\n${table.orders.map(o => `- ${o.itemName}: ${o.quantity} units (Profit: ₹${(Number(o.price) - Number(o.costPrice || 0)) * Number(o.quantity)})`).join('\n')}`,
    amount: table.totalAmount,
    profit: totalProfit,
    type: 'income',
    locationId: table.locationId,
    proofImage: req.file.path,
    createdBy: req.user._id,
    date: new Date(),
  });

  // Reset table
  table.isBooked = false;
  table.status = 'available';
  table.orders = [];
  table.totalAmount = 0;
  table.numberOfPeople = 0;
  
  await table.save();

  await sendNotification({
    title: 'Session Archived',
    message: `Table ${table.tableNumber} session closed. Revenue recorded.`,
    type: 'table_action',
    performedByUser: req.user,
    locationId: table.locationId,
  });

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

  if (req.user.role === 'location_admin' && table.locationId.toString() !== req.user.assignedLocation.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete tables from other locations');
  }

  await table.deleteOne();

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

  table.status = 'available';
  table.isBooked = false;
  table.orders = [];
  table.totalAmount = 0;
  table.numberOfPeople = 0;
  
  await table.save();

  res.json({
    success: true,
    data: table,
  });
});

// @desc    Update table details
// @route   PUT /api/tables/:id
// @access  Private (Admin, Location Admin)
const updateTable = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id);

  if (!table) {
    res.status(404);
    throw new Error('Table not found');
  }

  if (req.user.role === 'location_admin' && table.locationId.toString() !== req.user.assignedLocation.toString()) {
    res.status(403);
    throw new Error('Not authorized to update tables from other locations');
  }

  const updatedTable = await Table.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

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
