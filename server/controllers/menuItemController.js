const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/auditLogger');

// @desc    Get all menu items with filters
// @route   GET /api/menu
// @access  Private
const getMenuItems = asyncHandler(async (req, res) => {
  const { category, minPrice, maxPrice, isAvailable, locationId, dietaryType } = req.query;

  const filter = {};

  if (category) filter.category = category;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
  }

  if (isAvailable !== undefined) {
    filter.isAvailable = isAvailable === 'true';
  }
  
  if (dietaryType) {
    filter.dietaryType = dietaryType;
  }

  // Location filter: global items (locationId: null) + location-specific
  if (locationId && locationId !== 'all' && locationId !== 'undefined' && locationId !== 'null') {
    filter.$or = [{ locationId: null }, { locationId }];
  }

  const items = await MenuItem.find(filter)
    .populate('category', 'name icon')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: items.length,
    data: items,
  });
});

// @desc    Get single menu item
// @route   GET /api/menu/:id
// @access  Private
const getMenuItem = asyncHandler(async (req, res) => {
  const item = await MenuItem.findById(req.params.id)
    .populate('category', 'name icon description')
    .populate('createdBy', 'name');

  if (!item) {
    res.status(404);
    throw new Error('Menu item not found');
  }

  res.json({
    success: true,
    data: item,
  });
});

// @desc    Create a menu item
// @route   POST /api/menu
// @access  Private (Admin, Location Admin)
const createMenuItem = asyncHandler(async (req, res, next) => {
  const {
    name, category, price, costPrice, originalPrice, discountedPrice,
    description, isAvailable, preparationTime, locationId, dietaryType, stock
  } = req.body;

  // Validate discountedPrice < originalPrice before creating
  if (
    discountedPrice !== undefined &&
    originalPrice !== undefined &&
    Number(discountedPrice) >= Number(originalPrice)
  ) {
    res.status(400);
    throw new Error('Discounted price must be less than original price');
  }

  const itemData = {
    name,
    category,
    price: Number(price),
    costPrice: costPrice ? Number(costPrice) : 0,
    description,
    isAvailable: isAvailable === 'on' || isAvailable === 'true' || isAvailable === true || isAvailable === undefined,
    preparationTime: preparationTime ? Number(preparationTime) : 10,
    locationId: locationId || null,
    dietaryType: dietaryType || 'veg',
    stock: stock ? Number(stock) : 0,
    createdBy: req.user._id,
  };

  if (originalPrice !== undefined) itemData.originalPrice = Number(originalPrice);
  if (discountedPrice !== undefined) itemData.discountedPrice = Number(discountedPrice);

  // Cloudinary image uploaded via multer middleware
  if (req.file) {
    itemData.image = req.file.path;
  }

  const item = await MenuItem.create(itemData);
  await item.populate('category', 'name icon');

  await logAction(req, 'MENU_ITEM_CREATE', `Created menu item: ${item.name} (₹${item.price})`);

  res.status(201).json({
    success: true,
    data: item,
  });
});

// @desc    Update a menu item
// @route   PUT /api/menu/:id
// @access  Private (Admin, Location Admin)
const updateMenuItem = asyncHandler(async (req, res, next) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Menu item not found');
  }

  const {
    name, category, price, costPrice, originalPrice, discountedPrice,
    description, isAvailable, preparationTime, locationId, dietaryType, stock
  } = req.body;

  // Validate discountedPrice < originalPrice
  const newOriginal = originalPrice !== undefined ? Number(originalPrice) : item.originalPrice;
  const newDiscounted = discountedPrice !== undefined ? Number(discountedPrice) : item.discountedPrice;

  if (
    newDiscounted !== undefined &&
    newOriginal !== undefined &&
    newDiscounted >= newOriginal
  ) {
    res.status(400);
    throw new Error('Discounted price must be less than original price');
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (category !== undefined) updates.category = category;
  if (price !== undefined) updates.price = Number(price);
  if (costPrice !== undefined) updates.costPrice = Number(costPrice);
  if (originalPrice !== undefined) updates.originalPrice = Number(originalPrice);
  if (discountedPrice !== undefined) updates.discountedPrice = Number(discountedPrice);
  if (description !== undefined) updates.description = description;
  if (isAvailable !== undefined) {
    updates.isAvailable = isAvailable === 'on' || isAvailable === 'true' || isAvailable === true;
  }
  if (preparationTime !== undefined) updates.preparationTime = Number(preparationTime);
  if (locationId !== undefined) updates.locationId = locationId || null;
  if (dietaryType !== undefined) updates.dietaryType = dietaryType;
  if (stock !== undefined) updates.stock = Number(stock);

  // If new image uploaded
  if (req.file) {
    updates.image = req.file.path;
  }

  const updated = await MenuItem.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).populate('category', 'name icon');

  await logAction(req, 'MENU_ITEM_UPDATE', `Updated menu item: ${updated.name}`);

  res.json({
    success: true,
    data: updated,
  });
});

// @desc    Delete a menu item
// @route   DELETE /api/menu/:id
// @access  Private (Admin, Location Admin)
const deleteMenuItem = asyncHandler(async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Menu item not found');
  }

  await item.deleteOne();

  await logAction(req, 'MENU_ITEM_DELETE', `Deleted menu item: ${item.name}`);

  res.json({
    success: true,
    message: 'Menu item removed successfully',
  });
});

// @desc    Toggle menu item availability
// @route   PUT /api/menu/:id/availability
// @access  Private (Admin, Location Admin)
const toggleAvailability = asyncHandler(async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Menu item not found');
  }

  item.isAvailable = !item.isAvailable;
  await item.save();

  res.json({
    success: true,
    data: item,
    message: `Item marked as ${item.isAvailable ? 'available' : 'unavailable'}`,
  });
});

// @desc    Update menu item stock
// @route   PUT /api/menu/:id/stock
// @access  Private
const updateStock = asyncHandler(async (req, res) => {
  const { stock } = req.body;
  const item = await MenuItem.findById(req.params.id);

  if (!item) {
    res.status(404);
    throw new Error('Menu item not found');
  }

  item.stock = Number(stock);
  await item.save();

  res.json({
    success: true,
    data: item,
    message: `Stock updated for ${item.name}`,
  });
});

module.exports = {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
  updateStock,
};
