const asyncHandler = require('../utils/asyncHandler');
const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const sendNotification = require('../utils/sendNotification');
const { canAccessLocation, scopedLocationId, clampLimit } = require('../utils/accessControl');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Inclusive list of YYYY-MM-DD strings between from..to (capped for safety).
const enumerateDates = (from, to) => {
  const out = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = start, i = 0; d <= end && i < 90; d.setUTCDate(d.getUTCDate() + 1), i++) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

// @desc    Create a leave request (self)
// @route   POST /api/leave-requests
const createLeaveRequest = asyncHandler(async (req, res) => {
  const { fromDate, toDate, type, reason } = req.body || {};
  if (!DATE_RE.test(fromDate || '') || !DATE_RE.test(toDate || '')) {
    res.status(400);
    throw new Error('fromDate and toDate must be valid (YYYY-MM-DD)');
  }
  if (toDate < fromDate) {
    res.status(400);
    throw new Error('toDate cannot be before fromDate');
  }
  const spanDays = Math.round((new Date(`${toDate}T00:00:00Z`) - new Date(`${fromDate}T00:00:00Z`)) / 86400000) + 1;
  if (spanDays > 90) {
    res.status(400);
    throw new Error('Leave cannot exceed 90 days in a single request');
  }
  const locationId = req.user.assignedLocation;
  if (!locationId) {
    res.status(400);
    throw new Error('You have no assigned branch to request leave for');
  }

  const leave = await LeaveRequest.create({
    user: req.user._id,
    locationId,
    fromDate,
    toDate,
    type: ['paid', 'unpaid', 'sick', 'casual'].includes(type) ? type : 'paid',
    reason: (reason || '').toString().slice(0, 500),
  });

  // Tell superiors a request is waiting.
  sendNotification({
    title: 'New leave request',
    message: `${req.user.name} requested ${leave.type} leave from ${fromDate} to ${toDate}.`,
    type: 'user_action',
    performedByUser: req.user,
    locationId,
  });

  res.status(201).json({ success: true, data: leave });
});

// @desc    List leave requests (self for staff/chef; branch-scoped for admins)
// @route   GET /api/leave-requests
const getLeaveRequests = asyncHandler(async (req, res) => {
  const { status, mine } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const isStaff = ['staff', 'chef'].includes(req.user.role);
  if (isStaff || mine === 'true') {
    filter.user = req.user._id;
  } else {
    const scope = scopedLocationId(req, req.query.locationId);
    if (scope) filter.locationId = scope;
  }

  const limit = clampLimit(req.query.limit, 50, 200);
  const requests = await LeaveRequest.find(filter)
    .populate('user', 'name role')
    .populate('reviewedBy', 'name deletedAt')
    .sort({ createdAt: -1 })
    .limit(limit);

  res.json({ success: true, data: requests });
});

// @desc    Approve / reject a leave request
// @route   PATCH /api/leave-requests/:id/review
const reviewLeaveRequest = asyncHandler(async (req, res) => {
  const { decision, reviewNote } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400);
    throw new Error('decision must be "approved" or "rejected"');
  }

  const existing = await LeaveRequest.findById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error('Leave request not found');
  }
  if (req.user.role !== 'super_admin' && !canAccessLocation(req.user, existing.locationId)) {
    res.status(403);
    throw new Error('You do not have access to this branch');
  }

  // Atomically claim the review so two concurrent approvals can't both stamp
  // attendance / fire the notification twice.
  const leave = await LeaveRequest.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { $set: { status: decision, reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: (reviewNote || '').toString().slice(0, 500) } },
    { new: true }
  ).populate('user', 'name');
  if (!leave) {
    res.status(400);
    throw new Error(`This request was already ${existing.status}`);
  }

  // On approval, stamp attendance for the range so payroll reflects it:
  // paid/sick/casual -> 'leave' (counts toward salary); unpaid -> 'absent'.
  if (decision === 'approved') {
    const attStatus = leave.type === 'unpaid' ? 'absent' : 'leave';
    const dates = enumerateDates(leave.fromDate, leave.toDate);
    for (const date of dates) {
      // Never overwrite a day the employee actually worked (present/half-day or
      // a real clock-in) — only stamp empty / non-worked days.
      const existing = await Attendance.findOne({ user: leave.user._id, date }).select('status checkIn');
      if (existing && (['present', 'half-day'].includes(existing.status) || existing.checkIn)) continue;
      await Attendance.findOneAndUpdate(
        { user: leave.user._id, date },
        { $set: { status: attStatus, locationId: leave.locationId, markedBy: req.user._id }, $setOnInsert: { user: leave.user._id, date } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
  }

  sendNotification({
    title: `Leave request ${decision}`,
    message: `Your ${leave.type} leave (${leave.fromDate} to ${leave.toDate}) was ${decision}${leave.reviewNote ? `: ${leave.reviewNote}` : ''}.`,
    type: 'user_action',
    performedByUser: req.user,
    locationId: leave.locationId,
  });

  res.json({ success: true, data: leave });
});

// @desc    Cancel own pending request
// @route   DELETE /api/leave-requests/:id
const cancelLeaveRequest = asyncHandler(async (req, res) => {
  const leave = await LeaveRequest.findById(req.params.id);
  if (!leave) {
    res.status(404);
    throw new Error('Leave request not found');
  }
  if (leave.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only cancel your own request');
  }
  if (leave.status !== 'pending') {
    res.status(400);
    throw new Error('Only a pending request can be cancelled');
  }
  await leave.deleteOne();

  await sendNotification({
    title: 'Leave request cancelled',
    message: `A leave request was cancelled by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
    locationId: req.user.assignedLocation,
  });

  res.json({ success: true });
});

module.exports = { createLeaveRequest, getLeaveRequests, reviewLeaveRequest, cancelLeaveRequest };
