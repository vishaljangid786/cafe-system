const Reservation = require('../models/Reservation');
const Table = require('../models/Table');
const Notification = require('../models/Notification');
const Expense = require('../models/Expense');
const User = require('../models/User');
const { getIO } = require('../config/socket');

// @desc    Check availability for a date/time
// @route   GET /api/reservations/availability
// @access  Private
exports.checkAvailability = async (req, res) => {
  try {
    const { locationId, date, startTime, endTime, reservationType, tableIds, excludeId } = req.query;

    if (!locationId || !date || !startTime || !endTime || !reservationType) {
      return res.status(400).json({ message: 'Please provide all required fields' });
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
      $or: [
        {
          $and: [
            { startTime: { $lte: startTime } },
            { endTime: { $gt: startTime } }
          ]
        },
        {
          $and: [
            { startTime: { $lt: endTime } },
            { endTime: { $gte: endTime } }
          ]
        },
        {
          $and: [
            { startTime: { $gte: startTime } },
            { endTime: { $lte: endTime } }
          ]
        }
      ]
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
        $or: [
          {
            $and: [
              { startTime: { $lte: startTime } },
              { endTime: { $gt: startTime } }
            ]
          },
          {
            $and: [
              { startTime: { $lt: endTime } },
              { endTime: { $gte: endTime } }
            ]
          }
        ]
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
            $or: [
                {
                    $and: [
                        { startTime: { $lte: startTime } },
                        { endTime: { $gt: startTime } }
                    ]
                },
                {
                    $and: [
                        { startTime: { $lt: endTime } },
                        { endTime: { $gte: endTime } }
                    ]
                }
            ]
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
    res.status(500).json({ message: error.message });
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
      locationId,
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
    const queryDate = new Date(date);
    
    // (Overlap logic similar to checkAvailability but for saving)
    // Check if full location is booked
    const fullLocCheck = await Reservation.findOne({
        locationId,
        date: queryDate,
        reservationType: 'full-location',
        status: { $ne: 'cancelled' },
        $or: [
            { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
            { startTime: { $lt: endTime }, endTime: { $gte: endTime } }
        ]
    });

    if (fullLocCheck) return res.status(400).json({ message: 'Location is already booked for this time' });

    if (reservationType === 'table') {
        const tableCheck = await Reservation.findOne({
            locationId,
            date: queryDate,
            status: { $ne: 'cancelled' },
            tableIds: { $in: tableIds },
            $or: [
                { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
                { startTime: { $lt: endTime }, endTime: { $gte: endTime } }
            ]
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

    // 2. Create Expense if payment received (advance or full)
    if (advancePayment > 0 || paymentStatus === 'paid') {
      const amount = paymentStatus === 'paid' ? totalAmount : advancePayment;
      await Expense.create({
        title: `Reservation Income - ${eventName}`,
        description: `Booking income for ${customerName} (${reservationType})`,
        amount: amount,
        type: 'income',
        date: queryDate,
        locationId,
        createdBy: req.user._id,
        proofImage: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg' // Placeholder as required
      });
    }

    // 3. Notify Admins & Staff
    const notification = await Notification.create({
      title: 'New Reservation Created',
      message: `${eventName} (${reservationType}) by ${customerName} at ${startTime}`,
      type: 'user_action',
      createdBy: req.user._id,
      roleTarget: ['super_admin', 'admin', 'branch_admin', 'staff'],
      locationId
    });

    // Real-time notification via Socket.io
    const io = getIO();
    io.emit('new_notification', notification);

    res.status(201).json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    if (eventName) query.eventName = { $regex: eventName, $options: 'i' };

    // STRICT RBAC
    if (req.user.role === 'super_admin') {
      if (locationId && locationId !== 'all') query.locationId = locationId;
    } else if (req.user.role === 'admin') {
      if (locationId && locationId !== 'all') {
        const isAccessible = req.user.accessibleLocations?.some(loc => loc.toString() === locationId);
        if (!isAccessible) return res.status(403).json({ message: 'Access denied to this location' });
        query.locationId = locationId;
      } else {
        query.locationId = { $in: req.user.accessibleLocations || [] };
      }
    } else {
      // Branch Admin, Chef, Staff
      query.locationId = req.user.assignedLocation;
    }

    if (search) {
      query.$or = [
        { eventName: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
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
    res.status(500).json({ message: error.message });
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

    res.status(200).json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update reservation
// @route   PUT /api/reservations/:id
// @access  Private
exports.updateReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    res.status(200).json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    await reservation.deleteOne();
    res.status(200).json({ message: 'Reservation removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
