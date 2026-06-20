const Reservation = require('../models/Reservation');
const Table = require('../models/Table');
const Expense = require('../models/Expense');
const sendNotification = require('../utils/sendNotification');
const TransactionService = require('../services/transactionService');
const { enforceLocationAccess, clampLimit, escapeRegex, scopedLocationId } = require('../utils/accessControl');

const getReservationLocationId = (reservation) => reservation.locationId?._id || reservation.locationId;

const resolveReservationLocation = (req, res, requestedLocationId) => {
  if (req.user.role === 'super_admin') return requestedLocationId;
  if (req.user.role === 'admin') {
    enforceLocationAccess(req, res, requestedLocationId);
    return requestedLocationId;
  }
  return req.user.assignedLocation;
};

const overlapQuery = (startTime, endTime) => ([
  { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
]);

// @desc    Check availability for a date/time
// @route   GET /api/reservations/availability
// @access  Private
exports.checkAvailability = async (req, res) => {
  try {
    let { locationId, date, startTime, endTime, reservationType, tableIds, excludeId } = req.query;

    if (!locationId || !date || !startTime || !endTime || !reservationType) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (req.user.role !== 'super_admin') {
      enforceLocationAccess(req, res, locationId);
    }

    const queryDate = new Date(date);
    
    // Base query for conflicts
    const baseConflictQuery = {
      locationId,
      date: queryDate,
      status: { $ne: 'cancelled' }
    };

    if (excludeId) {
      baseConflictQuery._id = { $ne: excludeId };
    }

    // 1. Check for Full Location Bookings
    const fullLocationBooking = await Reservation.findOne({
      ...baseConflictQuery,
      reservationType: 'full-location',
      $or: overlapQuery(startTime, endTime)
    });

    if (fullLocationBooking) {
      return res.status(200).json({ 
        available: false, 
        message: 'The entire location is booked for this time slot.',
        conflict: 'full-location'
      });
    }

    // 2. If checking for specific tables
    if (reservationType === 'table' && tableIds) {
      const selectedTableIds = Array.isArray(tableIds) ? tableIds : [tableIds];
      
      const overlappingTableBookings = await Reservation.find({
        locationId,
        date: queryDate,
        status: { $ne: 'cancelled' },
        tableIds: { $in: selectedTableIds },
        $or: overlapQuery(startTime, endTime)
      });

      if (overlappingTableBookings.length > 0) {
        return res.status(200).json({ 
          available: false, 
          message: 'One or more selected tables are already booked for this time slot.',
          conflict: 'table'
        });
      }
    }

    // 3. If checking for full location, check if ANY table is booked
    if (reservationType === 'full-location') {
        const anyTableBooking = await Reservation.findOne({
            locationId,
            date: queryDate,
            status: { $ne: 'cancelled' },
            $or: overlapQuery(startTime, endTime)
        });

        if (anyTableBooking) {
            return res.status(200).json({
                available: false,
                message: 'Cannot book full location because there are existing table bookings for this time slot.',
                conflict: 'table-overlap'
            });
        }
    }

    res.status(200).json({ available: true, message: 'Time slot is available' });
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: error.message });
  }
};

// @desc    Create a new reservation
// @route   POST /api/reservations
// @access  Private
exports.createReservation = async (req, res) => {
  try {
    const {
      eventName,
      reservationType,
      locationId: requestedLocationId,
      tableIds,
      date,
      startTime,
      endTime,
      isFullDay,
      customerName,
      customerPhone,
      totalAmount,
      advancePayment,
      paymentStatus,
      notes
    } = req.body;

    // 1. Validate availability again on backend
    const locationId = resolveReservationLocation(req, res, requestedLocationId);
    const queryDate = new Date(date);

    if (!locationId) {
      return res.status(400).json({ message: 'Location is required' });
    }

    if (reservationType === 'table' && tableIds?.length) {
      const selectedTableIds = Array.isArray(tableIds) ? tableIds : [tableIds];
      const tables = await Table.find({ _id: { $in: selectedTableIds }, locationId }).select('_id');
      if (tables.length !== selectedTableIds.length) {
        return res.status(403).json({ message: 'One or more tables are outside the selected location' });
      }
    }
    
    // (Overlap logic similar to checkAvailability but for saving)
    // Check if full location is booked
    const fullLocCheck = await Reservation.findOne({
        locationId,
        date: queryDate,
        reservationType: 'full-location',
        status: { $ne: 'cancelled' },
        $or: overlapQuery(startTime, endTime)
    });

    if (fullLocCheck) return res.status(400).json({ message: 'Location is already booked for this time' });

    if (reservationType === 'table') {
        const tableCheck = await Reservation.findOne({
            locationId,
            date: queryDate,
            status: { $ne: 'cancelled' },
            tableIds: { $in: tableIds },
            $or: overlapQuery(startTime, endTime)
        });
        if (tableCheck) return res.status(400).json({ message: 'Some tables are already booked for this time' });
    }

    const reservation = await Reservation.create({
      eventName,
      reservationType,
      userId: req.user._id,
      locationId,
      tableIds: reservationType === 'table' ? tableIds : [],
      date: queryDate,
      startTime,
      endTime,
      isFullDay,
      customerName,
      customerPhone,
      totalAmount,
      advancePayment,
      paymentStatus,
      status: 'confirmed', // Auto confirm if available
      notes
    });

    // 2. Create Expense + sync to Transaction ledger if payment received
    if (advancePayment > 0 || paymentStatus === 'paid') {
      const amount = paymentStatus === 'paid' ? totalAmount : advancePayment;
      const expense = await Expense.create({
        title: `Reservation Income - ${eventName}`,
        description: `Booking income for ${customerName} (${reservationType})`,
        amount,
        category: 'reservation',
        type: 'INCOME',
        date: queryDate,
        locationId,
        createdBy: req.user._id,
        proofImage: req.body.proofImage || 'reservation-payment',
        status: 'approved'
      });
      await TransactionService.syncExpenseToTransaction(expense);
    }

    // 3. Notify branch admins via sendNotification (persists to history + scoped socket emit)
    await sendNotification({
      title: 'New Reservation Created',
      message: `${eventName} (${reservationType}) by ${customerName} at ${startTime}`,
      type: 'user_action',
      performedByUser: req.user,
      locationId
    });

    res.status(201).json(reservation);
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: error.message });
  }
};

// @desc    Get all reservations
// @route   GET /api/reservations
// @access  Private
exports.getReservations = async (req, res) => {
  try {
    const { date, eventName, locationId, status, search } = req.query;
    let query = {};

    if (date) query.date = new Date(date);
    if (status) query.status = status;
    if (eventName) query.eventName = { $regex: escapeRegex(eventName), $options: 'i' };

    const branchScope = scopedLocationId(req, locationId);
    if (branchScope) query.locationId = branchScope;

    if (search) {
      query.$or = [
        { eventName: { $regex: escapeRegex(search), $options: 'i' } },
        { customerName: { $regex: escapeRegex(search), $options: 'i' } },
        { customerPhone: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = clampLimit(req.query.limit, 20);
    const skip = (page - 1) * limit;

    const total = await Reservation.countDocuments(query);

    const reservations = await Reservation.find(query)
      .populate('locationId', 'name')
      .populate('tableIds', 'tableNumber')
      .sort({ date: -1, startTime: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ 
      success: true, 
      count: reservations.length, 
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: reservations 
    });
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: error.message });
  }
};

// @desc    Get reservation by ID
// @route   GET /api/reservations/:id
// @access  Private
exports.getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('locationId', 'name')
      .populate('tableIds', 'tableNumber')
      .populate('userId', 'name email');

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    enforceLocationAccess(req, res, getReservationLocationId(reservation));

    res.status(200).json(reservation);
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: error.message });
  }
};

// @desc    Update reservation
// @route   PUT /api/reservations/:id
// @access  Private
exports.updateReservation = async (req, res) => {
  try {
    const existing = await Reservation.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    enforceLocationAccess(req, res, getReservationLocationId(existing));

    const updateData = { ...req.body };
    const locationId = updateData.locationId
      ? resolveReservationLocation(req, res, updateData.locationId)
      : getReservationLocationId(existing);
    updateData.locationId = locationId;

    // Re-check availability if any scheduling field changed
    const timeChanged = updateData.startTime || updateData.endTime || updateData.date || updateData.tableIds || updateData.reservationType;
    if (timeChanged) {
      const queryDate = new Date(updateData.date || existing.date);
      const startTime = updateData.startTime || existing.startTime;
      const endTime = updateData.endTime || existing.endTime;
      const reservationType = updateData.reservationType || existing.reservationType;
      const tableIds = updateData.tableIds || existing.tableIds;

      if (reservationType === 'table' && tableIds?.length) {
        const selectedTableIds = Array.isArray(tableIds) ? tableIds : [tableIds];
        const tables = await Table.find({ _id: { $in: selectedTableIds }, locationId }).select('_id');
        if (tables.length !== selectedTableIds.length) {
          return res.status(403).json({ message: 'One or more tables are outside the selected location' });
        }
        const tableCheck = await Reservation.findOne({
          locationId,
          date: queryDate,
          status: { $ne: 'cancelled' },
          tableIds: { $in: selectedTableIds },
          _id: { $ne: existing._id },
          $or: overlapQuery(startTime, endTime)
        });
        if (tableCheck) return res.status(400).json({ message: 'Some tables are already booked for this time' });
      }

      const fullLocCheck = await Reservation.findOne({
        locationId,
        date: queryDate,
        reservationType: 'full-location',
        status: { $ne: 'cancelled' },
        _id: { $ne: existing._id },
        $or: overlapQuery(startTime, endTime)
      });
      if (fullLocCheck) return res.status(400).json({ message: 'Location is already fully booked for this time' });
    }

    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json(reservation);
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: error.message });
  }
};

// @desc    Delete reservation
// @route   DELETE /api/reservations/:id
// @access  Private
exports.deleteReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    enforceLocationAccess(req, res, getReservationLocationId(reservation));

    await reservation.deleteOne();
    res.status(200).json({ message: 'Reservation removed' });
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: error.message });
  }
};
