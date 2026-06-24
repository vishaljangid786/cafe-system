const asyncHandler = require('../utils/asyncHandler');
const Feedback = require('../models/Feedback');
const Location = require('../models/Location');
const mongoose = require('mongoose');
const { scopedLocationId, clampLimit } = require('../utils/accessControl');

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

  const fb = await Feedback.create({
    locationId,
    orderId: mongoose.isValidObjectId(orderId) ? orderId : null,
    customerName: (customerName || '').toString().slice(0, 120),
    customerPhone: (customerPhone || '').toString().slice(0, 20),
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

module.exports = { submitFeedback, getFeedback };
