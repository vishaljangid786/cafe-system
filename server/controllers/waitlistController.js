const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const Waitlist = require('../models/Waitlist');
const { canAccessLocation, scopedLocationId, clampLimit } = require('../utils/accessControl');
const { requireRecord, assertCanDelete, announceDeletion } = require('../utils/deleteGuard');

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

// @desc    Remove a waitlist entry outright (mis-typed party, duplicate, test row)
// @route   DELETE /api/waitlist/:id
// @access  Private (waitlist.delete)
const deleteWaitlistEntry = asyncHandler(async (req, res) => {
  // A malformed id would otherwise surface as a CastError 500; the floor staff
  // needs to know the row reference is stale, not that the server broke.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400);
    throw new Error('That waitlist id is not valid. Refresh the waitlist and try again.');
  }

  const entry = await Waitlist.findById(req.params.id).populate('tableId', 'tableNumber');
  requireRecord(res, entry, 'Waitlist entry');

  // No `ownerId`: the staff member who added the party is not its owner in any
  // meaningful sense — the entry belongs to the floor. Deleting always needs
  // waitlist.delete AND reach over the entry's branch.
  assertCanDelete(req, res, {
    resource: 'waitlist entry',
    actionKey: 'waitlist.delete',
    locationId: entry.locationId,
  });

  const tableNumber = entry.tableId?.tableNumber;

  // Cascade decision: we deliberately do NOT free the linked Table. A seated
  // entry means the party is physically at that table; resetting the table to
  // available here would invite a double-seating. The table's own lifecycle is
  // owned by the table/order flow, so we only flag it in the notification below
  // so a manager can clear it by hand if the party really did leave.
  const detail = entry.status === 'seated'
    ? `This party was already seated${tableNumber ? ` at table ${tableNumber}` : ''} — the table was left as-is, free it from the floor map if they have left.`
    : '';

  await entry.deleteOne();

  await announceDeletion(req, {
    resource: 'Waitlist entry',
    // Name the party explicitly: the floor manager's only question is "which
    // walk-in just disappeared from the queue?".
    name: `${entry.customerName} (party of ${entry.partySize})`,
    locationId: entry.locationId,
    action: 'WAITLIST_DELETE',
    type: 'table_action',
    priority: 'medium',
    // The staff member who queued the party is usually not a manager, so the
    // standard fan-out never reaches them — but they are the one still calling
    // that name out at the door.
    notifyUserIds: entry.addedBy ? [entry.addedBy] : [],
    detail,
    metadata: {
      customerName: entry.customerName,
      customerPhone: entry.customerPhone || null,
      partySize: entry.partySize,
      status: entry.status,
      tableNumber: tableNumber || null,
    },
  });

  res.json({
    success: true,
    message: 'Waitlist entry removed',
  });
});

module.exports = { addToWaitlist, getWaitlist, updateWaitlistEntry, deleteWaitlistEntry };
