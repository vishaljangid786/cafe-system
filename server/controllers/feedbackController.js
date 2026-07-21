const asyncHandler = require('../utils/asyncHandler');
const Feedback = require('../models/Feedback');
const Location = require('../models/Location');
const mongoose = require('mongoose');
const { scopedLocationId, clampLimit } = require('../utils/accessControl');
const { requireRecord, assertCanDelete, announceDeletion } = require('../utils/deleteGuard');

const clampRating = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null;
};

// @desc    Submit feedback (PUBLIC — via QR/link, no auth)
// @route   POST /api/feedback
const submitFeedback = asyncHandler(async (req, res) => {
  const { locationId, orderId, customerName, customerPhone, rating, foodRating, serviceRating, comment, source } = req.body || {};

  const r = clampRating(rating);
  if (!r) {
    res.status(400);
    throw new Error('A rating between 1 and 5 is required');
  }
  if (!mongoose.isValidObjectId(locationId)) {
    res.status(400);
    throw new Error('A valid branch is required');
  }
  const branch = await Location.findById(locationId).select('_id');
  if (!branch) {
    res.status(404);
    throw new Error('Branch not found');
  }
  const cleanCustomerPhone = (customerPhone || '').toString().replace(/\D/g, '').slice(0, 15);
  if (customerPhone && cleanCustomerPhone.length < 10) {
    res.status(400);
    throw new Error('Please provide a valid phone number');
  }

  const fb = await Feedback.create({
    locationId,
    orderId: mongoose.isValidObjectId(orderId) ? orderId : null,
    customerName: (customerName || '').toString().trim().slice(0, 120),
    customerPhone: cleanCustomerPhone,
    rating: r,
    foodRating: clampRating(foodRating) || undefined,
    serviceRating: clampRating(serviceRating) || undefined,
    comment: (comment || '').toString().slice(0, 1000),
    // Public endpoint: a submitter cannot claim 'staff'-collected provenance.
    source: source === 'qr' ? 'qr' : 'web',
  });

  res.status(201).json({ success: true, data: { _id: fb._id }, message: 'Thank you for your feedback!' });
});

// @desc    List feedback + stats (admin, branch-scoped)
// @route   GET /api/feedback
const getFeedback = asyncHandler(async (req, res) => {
  const match = {};
  const scope = scopedLocationId(req, req.query.locationId);
  if (scope) {
    match.locationId = typeof scope === 'object' && scope.$in
      ? { $in: scope.$in.map((id) => new mongoose.Types.ObjectId(id.toString())) }
      : new mongoose.Types.ObjectId(scope.toString());
  }

  const [list, statsAgg] = await Promise.all([
    Feedback.find(match).populate('locationId', 'name').sort({ createdAt: -1 }).limit(clampLimit(req.query.limit, 50, 200)),
    Feedback.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          avgFood: { $avg: '$foodRating' },
          avgService: { $avg: '$serviceRating' },
          count: { $sum: 1 },
          five: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          four: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          three: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          two: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          one: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const s = statsAgg[0] || {};
  res.json({
    success: true,
    data: list,
    stats: {
      avgRating: s.avgRating ? Number(s.avgRating.toFixed(2)) : 0,
      avgFood: s.avgFood ? Number(s.avgFood.toFixed(2)) : 0,
      avgService: s.avgService ? Number(s.avgService.toFixed(2)) : 0,
      count: s.count || 0,
      distribution: { 5: s.five || 0, 4: s.four || 0, 3: s.three || 0, 2: s.two || 0, 1: s.one || 0 },
    },
  });
});

// @desc    Delete one feedback entry (spam, duplicate, test row, wrong branch)
// @route   DELETE /api/feedback/:id
// @access  Private (feedback.delete)
const deleteFeedback = asyncHandler(async (req, res) => {
  // A malformed id would otherwise surface as a CastError 500; the operator needs
  // to know their list is stale, not that the server broke.
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error('That feedback id is not valid. Refresh the feedback list and try again.');
  }

  const feedback = await Feedback.findById(req.params.id);
  requireRecord(res, feedback, 'Feedback');

  // locationId is required on the model, so branch scoping always applies here —
  // a branch admin can only remove feedback about a branch they actually manage.
  assertCanDelete(req, res, {
    resource: 'feedback entry',
    actionKey: 'feedback.delete',
    locationId: feedback.locationId,
  });

  // Business rule: feedback is the branch's public score. A 1–2★ entry is a
  // complaint, and letting the very people it reflects on erase it turns the
  // rating into fiction (delete the bad reviews → average climbs). So a negative
  // entry may only be removed by a cafe-level administrator, who is not the
  // person being rated. Everyone else gets told the safe alternative: escalate it.
  const isComplaint = feedback.rating <= 2;
  if (isComplaint && !['super_admin', 'admin'].includes(req.user.role)) {
    res.status(400);
    throw new Error(
      `This is a ${feedback.rating}-star complaint and it counts towards this branch's rating. Only a cafe administrator can remove it — escalate it to them if it is spam or a duplicate.`
    );
  }

  // Cascade decision: nothing to clean up. The linked Order is independent (it
  // survives fine without its feedback) and every rating figure the app shows is
  // aggregated live from this collection on read — there is no denormalised
  // average to repair. Removing the row IS the whole side effect, which is
  // exactly why the numbers below are captured into the audit record.
  await feedback.deleteOne();

  const guest = (feedback.customerName || '').trim() || 'an anonymous guest';

  await announceDeletion(req, {
    resource: 'Feedback',
    name: `${feedback.rating}-star review from ${guest}`,
    locationId: feedback.locationId,
    action: 'FEEDBACK_DELETE',
    type: 'activity',
    // High: this silently moves a branch's average rating, so the people who
    // report on that number must see it happen.
    priority: 'high',
    detail: `Branch rating figures will change. Removed rating: ${feedback.rating}/5.`,
    // The deletion is only reviewable if what disappeared is still readable:
    // keep the full scores and the guest's own words in the audit row.
    metadata: {
      feedbackId: feedback._id.toString(),
      rating: feedback.rating,
      foodRating: feedback.foodRating ?? null,
      serviceRating: feedback.serviceRating ?? null,
      comment: feedback.comment || '',
      customerName: feedback.customerName || '',
      customerPhone: feedback.customerPhone || '',
      source: feedback.source,
      orderId: feedback.orderId ? feedback.orderId.toString() : null,
      submittedAt: feedback.createdAt,
    },
  });

  res.json({ success: true, message: 'Feedback removed' });
});

module.exports = { submitFeedback, getFeedback, deleteFeedback };
