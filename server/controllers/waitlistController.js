const asyncHandler = require('../utils/asyncHandler');
const Waitlist = require('../models/Waitlist');
const { canAccessLocation, scopedLocationId, clampLimit } = require('../utils/accessControl');

const resolveBranch = (req, res, fromBody) => {
  const branchScoped = ['staff', 'chef', 'branch_admin', 'location_admin'].includes(req.user.role);
  const locationId = branchScoped ? req.user.assignedLocation : fromBody;
  if (!locationId) {
    res.status(400);
    throw new Error('A branch (locationId) is required');
  }
  if (!branchScoped && req.user.role !== 'super_admin' && !canAccessLocation(req.user, locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch');
  }
  return locationId;
};

// @desc    Add a walk-in party to the waitlist
// @route   POST /api/waitlist
const addToWaitlist = asyncHandler(async (req, res) => {
  const { customerName, customerPhone, partySize, quotedWaitMinutes, notes, locationId } = req.body || {};
  if (!customerName || !customerName.trim()) {
    res.status(400);
    throw new Error('Customer name is required');
  }
  const branch = resolveBranch(req, res, locationId);
  const entry = await Waitlist.create({
    locationId: branch,
    customerName: customerName.trim().slice(0, 120),
    customerPhone: (customerPhone || '').toString().slice(0, 20),
    partySize: Math.max(1, Number(partySize) || 1),
    quotedWaitMinutes: Math.max(0, Number(quotedWaitMinutes) || 0),
    notes: (notes || '').toString().slice(0, 300),
    addedBy: req.user._id,
  });
  res.status(201).json({ success: true, data: entry });
});

// @desc    List waitlist entries (branch-scoped; defaults to waiting only)
// @route   GET /api/waitlist
const getWaitlist = asyncHandler(async (req, res) => {
  const filter = { status: req.query.status || 'waiting' };
  const branchScoped = ['staff', 'chef', 'branch_admin', 'location_admin'].includes(req.user.role);
  if (branchScoped) {
    filter.locationId = req.user.assignedLocation;
  } else {
    const scope = scopedLocationId(req, req.query.locationId);
    if (scope) filter.locationId = scope;
  }
  const entries = await Waitlist.find(filter)
    .populate('tableId', 'tableNumber')
    .sort({ createdAt: 1 }) // oldest first = next in line
    .limit(clampLimit(req.query.limit, 100, 300));
  res.json({ success: true, data: entries });
});

// @desc    Update a waitlist entry's status (seat / cancel / no-show)
// @route   PATCH /api/waitlist/:id
const updateWaitlistEntry = asyncHandler(async (req, res) => {
  const { status, tableId } = req.body || {};
  if (!['seated', 'cancelled', 'no-show'].includes(status)) {
    res.status(400);
    throw new Error('status must be seated, cancelled, or no-show');
  }

  const entry = await Waitlist.findById(req.params.id);
  if (!entry) {
    res.status(404);
    throw new Error('Waitlist entry not found');
  }
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, entry.locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch');
  }

  // Atomic transition: only a still-waiting entry can be acted on, so two staff
  // can't seat / cancel the same party twice.
  const set = { status };
  if (status === 'seated') {
    set.seatedAt = new Date();
    if (tableId) {
      // Only accept a table that actually belongs to this entry's branch.
      const Table = require('../models/Table');
      const table = await Table.findOne({ _id: tableId, locationId: entry.locationId }).select('_id');
      if (!table) {
        res.status(400);
        throw new Error('That table does not belong to this branch');
      }
      set.tableId = table._id;
    }
  }
  const updated = await Waitlist.findOneAndUpdate(
    { _id: entry._id, status: 'waiting' },
    { $set: set },
    { new: true }
  );
  if (!updated) {
    res.status(400);
    throw new Error(`This party was already ${entry.status}`);
  }

  // Seating a party onto a table marks that table occupied so the floor map /
  // table list no longer shows it free (preventing a double walk-in seating).
  if (updated.status === 'seated' && updated.tableId) {
    const Table = require('../models/Table');
    await Table.findByIdAndUpdate(updated.tableId, {
      status: 'booked',
      isBooked: true,
      numberOfPeople: updated.partySize,
      customerName: updated.customerName,
    }).catch(() => {});
  }

  res.json({ success: true, data: updated });
});

module.exports = { addToWaitlist, getWaitlist, updateWaitlistEntry };
