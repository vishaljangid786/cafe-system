const Coupon = require('../models/Coupon');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');

// @desc    Get all coupons (admin view)
// @route   GET /api/coupons
// @access  Private (Admin)
const getCoupons = asyncHandler(async (req, res) => {
  const { active } = req.query;
  const filter = {};
  if (active === 'true') {
    filter.isActive = true;
  } else if (active === 'false') {
    filter.isActive = false;
  }
  const coupons = await Coupon.find(filter).populate('createdBy', 'name');
  res.json({ success: true, count: coupons.length, data: coupons });
});

// @desc    Create a new coupon
// @route   POST /api/coupons
// @access  Private (Admin)
const createCoupon = asyncHandler(async (req, res) => {
  const { code, discountType, discountValue, maxDiscount, minOrderAmount, expiryDate, usageLimit, appliesTo } = req.body;

  // Basic validation
  if (new Date(expiryDate) <= new Date()) {
    res.status(400);
    throw new Error('Expiry date must be in the future');
  }

  const existing = await Coupon.findOne({ code: code.toUpperCase() });
  if (existing) {
    res.status(400);
    throw new Error('Coupon code already exists');
  }

  const coupon = await Coupon.create({
    code,
    discountType,
    discountValue,
    maxDiscount,
    minOrderAmount,
    expiryDate,
    usageLimit,
    appliesTo: appliesTo || {},
    createdBy: req.user._id,
  });

  // Notify staff about new active coupon
  await sendNotification({
    title: 'New Coupon Available',
    message: `Coupon ${coupon.code} is now active!`,
    type: 'coupon_created',
    performedByUser: req.user,
  });

  res.status(201).json({ success: true, data: coupon });
});

// @desc    Update a coupon
// @route   PUT /api/coupons/:id
// @access  Private (Admin)
const updateCoupon = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (updates.expiryDate && new Date(updates.expiryDate) <= new Date()) {
    res.status(400);
    throw new Error('Expiry date must be in the future');
  }
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }
  res.json({ success: true, data: coupon });
});

// @desc    Soft‑delete a coupon (deactivate)
// @route   DELETE /api/coupons/:id
// @access  Private (Admin)
const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }
  coupon.isActive = false;
  await coupon.save();
  res.json({ success: true, message: 'Coupon deactivated' });
});

// @desc    Apply a coupon to an order (called from checkout)
// @route   POST /api/coupons/apply
// @access  Private (Staff, Admin)
const applyCoupon = asyncHandler(async (req, res) => {
  const { code, orderAmount, orderItems } = req.body; // orderItems array of {menuItemId, price, quantity}
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found or inactive');
  }

  // Validate expiry
  if (coupon.expiryDate < new Date()) {
    res.status(400);
    throw new Error('Coupon has expired');
  }

  // Validate usage limit
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    res.status(400);
    throw new Error('Coupon usage limit reached');
  }

  // Validate min order amount
  if (orderAmount < coupon.minOrderAmount) {
    res.status(400);
    throw new Error(`Order amount must be at least ${coupon.minOrderAmount}`);
  }

  // Determine applicable subtotal
  let applicableSubtotal = 0;
  if ((coupon.appliesTo?.items?.length || 0) > 0) {
    const itemIds = coupon.appliesTo.items.map(id => id.toString());
    orderItems.forEach(i => {
      if (itemIds.includes(i.menuItemId?.toString())) {
        applicableSubtotal += i.price * i.quantity;
      }
    });
  } else if ((coupon.appliesTo?.categories?.length || 0) > 0) {
    // For category‑level discounts we need MenuItem data – simplify by assuming orderItems already contain categoryId
    const catIds = coupon.appliesTo.categories.map(id => id.toString());
    orderItems.forEach(i => {
      if (catIds.includes(i.categoryId?.toString())) {
        applicableSubtotal += i.price * i.quantity;
      }
    });
  } else {
    // Applies to full order
    applicableSubtotal = orderAmount;
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = (applicableSubtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount !== null && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else {
    discount = coupon.discountValue;
    if (discount > applicableSubtotal) discount = applicableSubtotal;
  }

  const finalAmount = Math.max(0, orderAmount - discount);

  // Increment usage atomically
  await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });

  res.json({
    success: true,
    data: { discount, finalAmount, couponId: coupon._id, code: coupon.code },
  });
});

module.exports = {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon,
};
