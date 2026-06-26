const Coupon = require('../models/Coupon');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { logActivity } = require('../utils/auditLogger');
const { clampLimit, escapeRegex } = require('../utils/accessControl');

// @desc    Get all coupons (admin view)
// @route   GET /api/coupons
// @access  Private (Admin)
const getCoupons = asyncHandler(async (req, res) => {
  const { active, search } = req.query;
  const filter = {};
  if (active === 'true') filter.isActive = true;
  else if (active === 'false') filter.isActive = false;
  if (search) filter.code = new RegExp(escapeRegex(search), 'i');
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  const total = await Coupon.countDocuments(filter);

  const coupons = await Coupon.find(filter)
    .populate('createdBy', 'name')
    .skip(skip)
    .limit(limit);

  res.json({ 
    success: true, 
    count: coupons.length, 
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
    data: coupons 
  });
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

  const numDiscount = Number(discountValue);
  if (!Number.isFinite(numDiscount) || numDiscount <= 0) {
    res.status(400);
    throw new Error('Discount value must be a positive number');
  }
  if (discountType === 'percentage' && numDiscount > 100) {
    res.status(400);
    throw new Error('Percentage discount cannot exceed 100%');
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
    isActive: req.body.isActive === 'on' || req.body.isActive === 'true' || req.body.isActive === true || req.body.isActive === undefined,
    createdBy: req.user._id,
  });

  await logActivity(
    req.user,
    'COUPON_CREATE',
    `Created coupon ${coupon.code} with ${discountValue}${discountType === 'percentage' ? '%' : ' INR'} discount`,
    req,
    { couponId: coupon._id }
  );

  await sendNotification({
    title: 'Coupon Created',
    message: `Coupon "${coupon.code}" was created by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
  });

  res.status(201).json({ success: true, data: coupon });
});

// @desc    Update a coupon
// @route   PUT /api/coupons/:id
// @access  Private (Admin)
const updateCoupon = asyncHandler(async (req, res) => {
  // Whitelist editable fields so a client can't over-post usedCount/createdBy/etc
  // (resetting usedCount would defeat the usage limit).
  const ALLOWED = ['code', 'discountType', 'discountValue', 'maxDiscount', 'minOrderAmount', 'expiryDate', 'usageLimit', 'appliesTo', 'isActive'];
  const updates = {};
  ALLOWED.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  if (updates.expiryDate && new Date(updates.expiryDate) <= new Date()) {
    res.status(400);
    throw new Error('Expiry date must be in the future');
  }

  if (updates.isActive !== undefined) {
    updates.isActive = updates.isActive === 'on' || updates.isActive === 'true' || updates.isActive === true;
  }

  if (updates.discountValue !== undefined || updates.discountType !== undefined) {
    const existing = await Coupon.findById(req.params.id).select('discountType discountValue');
    const effType = updates.discountType ?? existing?.discountType;
    const effVal = Number(updates.discountValue ?? existing?.discountValue);
    if (!Number.isFinite(effVal) || effVal <= 0) {
      res.status(400);
      throw new Error('Discount value must be a positive number');
    }
    if (effType === 'percentage' && effVal > 100) {
      res.status(400);
      throw new Error('Percentage discount cannot exceed 100%');
    }
  }

  const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }

  await logActivity(
    req.user,
    'COUPON_UPDATE',
    `Updated coupon ${coupon.code} configuration`,
    req,
    { couponId: coupon._id, changes: updates }
  );

  await sendNotification({
    title: 'Coupon Updated',
    message: `Coupon "${coupon.code}" was updated by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
  });

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

  await logActivity(
    req.user,
    'COUPON_DEACTIVATE',
    `Deactivated coupon ${coupon.code}`,
    req,
    { couponId: coupon._id }
  );

  await sendNotification({
    title: 'Coupon Deactivated',
    message: `Coupon "${coupon.code}" was deactivated by ${req.user.name}.`,
    type: 'activity',
    priority: 'high',
    performedByUser: req.user,
  });

  res.json({ success: true, message: 'Coupon deactivated' });
});

// @desc    Apply a coupon to an order (called from checkout)
// @route   POST /api/coupons/apply
// @access  Private (Staff, Admin)
const applyCoupon = asyncHandler(async (req, res) => {
  const { code, orderAmount } = req.body; 
  const orderItems = req.body.orderItems || []; // orderItems array of {menuItemId, price, quantity}
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
    const MenuItem = require('../models/MenuItem');
    const catIds = coupon.appliesTo.categories.map(id => id.toString());
    const menuItemIds = orderItems.map(i => i.menuItemId).filter(Boolean);
    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } }).select('_id category').lean();
    const itemCategoryMap = new Map(menuItems.map(m => [m._id.toString(), m.category?.toString()]));
    orderItems.forEach(i => {
      if (catIds.includes(itemCategoryMap.get(i.menuItemId?.toString()))) {
        applicableSubtotal += i.price * i.quantity;
      }
    });
  } else {
    // Applies to full order
    applicableSubtotal = orderAmount;
  }

  // If specific items/categories were targeted but none found in order
  if (((coupon.appliesTo?.items?.length || 0) > 0 || (coupon.appliesTo?.categories?.length || 0) > 0) && applicableSubtotal === 0) {
    res.status(400);
    throw new Error('This coupon is not applicable to the items in your current order');
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = (applicableSubtotal * coupon.discountValue) / 100;
  } else {
    discount = coupon.discountValue;
    if (discount > applicableSubtotal) discount = applicableSubtotal;
  }
  // Cap at maxDiscount for BOTH types — matching the authoritative server path
  // (orderService._createOrder). Previously only percentage coupons were capped,
  // so a fixed coupon with a maxDiscount quoted a bigger discount at checkout
  // than the order was actually granted.
  if (coupon.maxDiscount && discount > coupon.maxDiscount) {
    discount = coupon.maxDiscount;
  }

  const finalAmount = Math.max(0, orderAmount - discount);

  res.json({
    success: true,
    data: { discount, finalAmount, couponId: coupon._id, code: coupon.code },
  });
});

// @desc    Get single coupon
// @route   GET /api/coupons/:id
const getCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id).populate('createdBy', 'name');
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }
  res.json({ success: true, data: coupon });
});

module.exports = {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon,
};
