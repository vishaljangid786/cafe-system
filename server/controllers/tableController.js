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

  // Today's confirmed reservations, so the table grid can show which tables are
  // reserved (previously a reservation only surfaced as an error at order time).
  const Reservation = require('../models/Reservation');
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const locationIds = [...new Set(tables.map((t) => (t.locationId?._id || t.locationId)?.toString()).filter(Boolean))];
  const todaysReservations = locationIds.length
    ? await Reservation.find({
        locationId: { $in: locationIds },
        status: 'confirmed',
        date: { $gte: startOfToday, $lte: endOfToday },
      }).select('reservationType tableIds locationId eventName startTime endTime customerName').lean()
    : [];

  const reservationFor = (table) => {
    const locId = (table.locationId?._id || table.locationId)?.toString();
    const tableId = table._id.toString();
    return todaysReservations.find((r) =>
      r.locationId?.toString() === locId &&
      (r.reservationType === 'full-location' || (r.tableIds || []).some((tid) => tid.toString() === tableId))
    );
  };

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

    // Reservation indicator for today.
    const r = reservationFor(table);
    tableObj.reservation = r ? {
      eventName: r.eventName,
      startTime: r.startTime,
      endTime: r.endTime,
      customerName: r.customerName,
      fullLocation: r.reservationType === 'full-location',
    } : null;

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

  if (!finalLocationId && ['branch_admin', 'location_admin', 'staff'].includes(req.user.role)) {
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
    title: 'New Table Added',
    message: `Table ${table.tableName || table.tableNumber} was added by ${req.user.name}.`,
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

  // Guard on operational state, not just the isBooked flag: a table that is
  // 'ongoing' (live orders) or still has active orders must not be re-seated —
  // otherwise the running tab's guest/customer details get clobbered.
  if (table.isBooked || ['booked', 'ongoing'].includes(table.status) || (table.activeOrdersCount || 0) > 0) {
    res.status(400);
    throw new Error('Table is already occupied');
  }

  // Reject walk-in seating that collides with a CONFIRMED reservation active
  // right now — either a full-location hold on this branch or a table-level hold
  // that includes this table. Mirrors the active-reservation lookup in
  // orderService so the two seating paths agree.
  const Reservation = require('../models/Reservation');
  const now = new Date();
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const activeReservation = await Reservation.findOne({
    locationId: table.locationId,
    date: today,
    status: 'confirmed',
    $or: [
      { reservationType: 'full-location' },
      { tableIds: table._id },
    ],
    startTime: { $lte: currentTimeStr },
    endTime: { $gte: currentTimeStr },
  });
  if (activeReservation) {
    res.status(400);
    throw new Error(
      activeReservation.reservationType === 'full-location'
        ? 'This location is reserved right now and cannot be seated as a walk-in'
        : 'This table is reserved right now and cannot be seated as a walk-in'
    );
  }

  // Validate guest count: must be a positive integer within the table's capacity.
  if (numberOfPeople !== undefined && numberOfPeople !== null && numberOfPeople !== '') {
    const guests = Number(numberOfPeople);
    if (!Number.isInteger(guests) || guests <= 0) {
      res.status(400);
      throw new Error('Number of people must be a positive whole number');
    }
    if (table.capacity && guests > table.capacity) {
      res.status(400);
      throw new Error(`Number of people cannot exceed the table capacity of ${table.capacity}`);
    }
  }

  table.isBooked = true;
  table.numberOfPeople = Number(req.body.numberOfPeople) || table.capacity || 1;
  table.customerName = req.body.customerName || '';
  table.status = 'booked';
  
  await table.save();

  await sendNotification({
    title: 'Table Occupied',
    message: `Table ${table.tableNumber} was seated with ${numberOfPeople} guests by ${req.user.name}.`,
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

  if (!Array.isArray(orders)) {
    res.status(400);
    throw new Error('Orders must be provided as an array');
  }

  // Sane upper bound for a single line-item quantity to reject absurd/abusive values.
  const MAX_LINE_QUANTITY = 1000;

  // Resolve all referenced menu items up front, then validate availability for
  // this table's branch and recompute prices/costs from the SERVER-side record.
  // Client-supplied price/costPrice/totals are never trusted.
  const MenuItem = require('../models/MenuItem');
  const menuItemIds = orders
    .map((item) => item && item.menuItemId)
    .filter((id) => id);
  const menuItems = menuItemIds.length
    ? await MenuItem.find({ _id: { $in: menuItemIds } })
    : [];
  const menuItemMap = new Map(menuItems.map((mi) => [mi._id.toString(), mi]));
  const branchId = table.locationId.toString();

  const validatedOrders = orders.map((item) => {
    if (!item || typeof item !== 'object') {
      res.status(400);
      throw new Error('Invalid order item');
    }

    // Quantity bounds: positive integer within a sane max.
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      res.status(400);
      throw new Error(`Each order item quantity must be a whole number between 1 and ${MAX_LINE_QUANTITY}`);
    }

    if (item.menuItemId) {
      const menuItem = menuItemMap.get(item.menuItemId.toString());
      if (!menuItem) {
        res.status(400);
        throw new Error('One or more selected menu items do not exist');
      }
      // Item must be available to this table's branch (global, or assigned to it).
      const availableHere =
        menuItem.isGlobal ||
        (menuItem.availableBranches || []).some((b) => b.toString() === branchId);
      if (!availableHere) {
        res.status(400);
        throw new Error(`"${menuItem.name}" is not available at this branch`);
      }
      // Use the server price/cost; ignore anything the client sent.
      return {
        menuItemId: menuItem._id,
        itemName: menuItem.name,
        quantity,
        price: Number(menuItem.price) || 0,
        costPrice: Number(menuItem.costPrice) || 0,
      };
    }

    // Manually entered item (no menuItemId). There is no server price to
    // recompute from, so validate the supplied price is a sane non-negative
    // number rather than trusting an arbitrary client total.
    const price = Number(item.price);
    if (!Number.isFinite(price) || price < 0) {
      res.status(400);
      throw new Error('Manual item price must be a non-negative number');
    }
    const costPrice = Number(item.costPrice);
    return {
      menuItemId: null,
      itemName: item.itemName || 'Item',
      quantity,
      price,
      costPrice: Number.isFinite(costPrice) && costPrice >= 0 ? costPrice : 0,
    };
  });

  table.orders = validatedOrders;
  table.totalAmount = validatedOrders.reduce((acc, item) => acc + (item.quantity * item.price), 0);

  if (req.body.customerName !== undefined) table.customerName = req.body.customerName;
  if (req.body.numberOfPeople !== undefined) {
    const guests = Number(req.body.numberOfPeople);
    if (!Number.isInteger(guests) || guests <= 0) {
      res.status(400);
      throw new Error('Number of people must be a positive whole number');
    }
    if (table.capacity && guests > table.capacity) {
      res.status(400);
      throw new Error(`Number of people cannot exceed the table capacity of ${table.capacity}`);
    }
    table.numberOfPeople = guests;
  }

  table.status = 'ongoing';

  await table.save();

  await sendNotification({
    title: 'Table Order Updated',
    message: `Table ${table.tableNumber} order was updated. Total bill: ₹${table.totalAmount}.`,
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
    throw new Error('A bill image is required');
  }

  // Payment tender chosen by the cashier (Cash / UPI / …). Recorded on every
  // order finalized in this bill so the sale lands under the right method in
  // revenue reporting and cash-drawer reconciliation — a UPI sale must never
  // inflate expected cash. Unknown/missing values fall back to CASH.
  const ALLOWED_PAYMENT_TYPES = ['CASH', 'UPI', 'CARD', 'ONLINE', 'OTHER'];
  const paymentType = ALLOWED_PAYMENT_TYPES.includes(req.body.paymentType)
    ? req.body.paymentType
    : 'CASH';

  table.billImage = req.file.path;
  table.status = 'completed';

  // Finalize only orders that have actually been served/are ready to bill.
  // Finalizing PLACED/ACCEPTED/PREPARING orders would record revenue (and deduct
  // inventory) for food that was never delivered to the customer.
  const sessionOrders = await Order.find({
    table: table._id,
    status: { $in: ['READY', 'SERVED', 'COMPLETED'] },
    isBilled: { $ne: true },
  }).populate('items.menuItem');

  // Refuse to bill while live (not-yet-served) kitchen orders remain — clearing
  // the table would orphan them and lose their revenue/inventory accounting.
  const liveOrder = await Order.findOne({
    table: table._id,
    status: { $in: ['PLACED', 'ACCEPTED', 'PREPARING'] },
  });
  if (liveOrder) {
    res.status(400);
    throw new Error('This table still has active kitchen orders that have not been served. Serve, complete, or cancel them before billing.');
  }

  // Stamp the chosen tender on the orders being billed (DB + the in-memory docs
  // finalizeOrder reads when writing the revenue Transaction). Skip orders that
  // were already settled by another method — e.g. a gift-card redemption sets
  // paymentType='GIFT_CARD' + amountPaid but leaves isBilled false; overwriting
  // it with the cashier's cash/UPI tender would re-tag prepaid money as cash and
  // inflate the expected cash drawer.
  const ordersToStamp = sessionOrders.filter(
    (o) => o.paymentType !== 'GIFT_CARD' && Number(o.amountPaid || 0) <= 0
  );
  if (ordersToStamp.length > 0) {
    await Order.updateMany(
      { _id: { $in: ordersToStamp.map((o) => o._id) } },
      { $set: { paymentType } }
    );
    ordersToStamp.forEach((o) => { o.paymentType = paymentType; });
  }

  const { finalizeOrder } = require('../utils/orderFinalizer');

  let finalizedCount = 0;
  for (const order of sessionOrders) {
    try {
      await finalizeOrder(order, req.user);
      finalizedCount += 1;
    } catch (err) {
      console.error(`Order ${order._id} finalization failed:`, err.message);
    }
  }

  // Staged-cart reconciliation: table.orders is an embedded "quick bill" cart with
  // no backing Order document. Convert any billable staged items into a real
  // COMPLETED Order and finalize it, so the sale's revenue (and recipe-ingredient
  // usage) is recorded in the ledger instead of being silently wiped when the
  // table is cleared below.
  const stagedItems = (table.orders || []).filter(
    (item) => item.menuItemId && Number(item.quantity) > 0
  );
  if (stagedItems.length > 0) {
    const stagedOrder = await Order.create({
      branch: table.locationId,
      table: table._id,
      customerName: table.customerName || '',
      items: stagedItems.map((i) => ({
        menuItem: i.menuItemId,
        itemName: i.itemName,
        price: Number(i.price) || 0,
        costPrice: Number(i.costPrice) || 0,
        quantity: Number(i.quantity) || 0,
      })),
      totalAmount: stagedItems.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0),
      discountAmount: Number(table.discountAmount) || 0,
      paymentType,
      createdBy: req.user._id,
      status: 'SERVED',
      statusHistory: [{ status: 'SERVED', timestamp: new Date(), updatedBy: req.user._id }],
    });
    // finalizeOrder needs populated menuItem refs to deduct recipe ingredients.
    await stagedOrder.populate('items.menuItem');
    try {
      await finalizeOrder(stagedOrder, req.user);
      finalizedCount += 1;
    } catch (err) {
      console.error(`Staged-cart order ${stagedOrder._id} finalization failed:`, err.message);
      // Couldn't record the sale — abort rather than wipe the cart and lose it.
      res.status(500);
      throw new Error('Could not record the table bill. Please try again.');
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
    title: 'Table Closed',
    message: `Table ${table.tableNumber} was closed and the bill saved.`,
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
    message: 'Table removed successfully',
  });
});

// @desc    Merge a table into another (move its orders + staged cart, free it)
// @route   PUT /api/tables/:id/merge
// @access  Private
const mergeTable = asyncHandler(async (req, res) => {
  const { targetTableId } = req.body || {};
  const source = await Table.findById(req.params.id);
  if (!source) {
    res.status(404);
    throw new Error('Source table not found');
  }
  enforceLocationAccess(req, res, source.locationId, 'You do not have permission to manage this table');

  if (String(req.params.id) === String(targetTableId)) {
    res.status(400);
    throw new Error('Cannot merge a table into itself');
  }
  const target = await Table.findOne({ _id: targetTableId, locationId: source.locationId });
  if (!target) {
    res.status(404);
    throw new Error('Target table not found in this branch');
  }

  // Move all live (kitchen) orders from source -> target.
  const ACTIVE = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];
  const moved = await Order.updateMany(
    { table: source._id, status: { $in: ACTIVE } },
    { $set: { table: target._id } }
  );
  const movedCount = moved.modifiedCount || moved.nModified || 0;

  // Move the embedded "staged cart" too.
  if (Array.isArray(source.orders) && source.orders.length) {
    target.orders = [...(target.orders || []), ...source.orders];
    target.totalAmount = (Number(target.totalAmount) || 0) + (Number(source.totalAmount) || 0);
  }
  target.activeOrdersCount = (Number(target.activeOrdersCount) || 0) + movedCount;
  if (movedCount > 0 || (target.orders || []).length) target.status = 'ongoing';
  await target.save();

  // Free the source table.
  source.orders = [];
  source.totalAmount = 0;
  source.activeOrdersCount = 0;
  source.isBooked = false;
  source.numberOfPeople = 0;
  source.customerName = '';
  source.status = 'available';
  await source.save();

  const io = getIO();
  io.to(`branch_${source.locationId}`).emit('table:update', { tableId: target._id, action: 'merge' });

  res.json({ success: true, data: { source, target, movedOrders: movedCount } });
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

  // Don't wipe a table that still has live kitchen orders — they'd be orphaned
  // and their revenue lost. Serve/complete or cancel them first.
  const Order = require('../models/Order');
  const liveOrder = await Order.findOne({
    table: table._id,
    status: { $nin: ['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'] },
  });
  if (liveOrder) {
    res.status(400);
    throw new Error('This table still has active orders. Complete or cancel them before clearing the table.');
  }

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

  // Strip location + operational/financial fields — these are owned by the order
  // flow, not by a manual table edit (over-posting them could corrupt billing/state).
  const { locationId: _l, orders, currentOrder, totalAmount, appliedCoupon, status, occupiedBy, occupiedAt, ...safeBody } = req.body;
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
  mergeTable,
  updateTable,
};
