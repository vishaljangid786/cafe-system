const MenuItem = require('../models/MenuItem');
const Location = require('../models/Location');
const BranchStock = require('../models/BranchStock');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/auditLogger');
const { clampLimit } = require('../utils/accessControl');

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

  // Location filter: global items (isGlobal: true) + branch-specific
  if (locationId && locationId !== 'all' && locationId !== 'undefined' && locationId !== 'null') {
    filter.$or = [{ isGlobal: true }, { availableBranches: locationId }];
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = clampLimit(req.query.limit, 20);
  const skip = (page - 1) * limit;

  const total = await MenuItem.countDocuments(filter);

  const items = await MenuItem.find(filter)
    .populate('category', 'name icon')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // If locationId is provided, merge branch-specific stock and availability
  let mergedItems = items;
  if (locationId && locationId !== 'all' && locationId !== 'undefined' && locationId !== 'null') {
    const branchStocks = await BranchStock.find({ branch: locationId });
    const stockMap = {};
    branchStocks.forEach(bs => {
      stockMap[bs.menuItem.toString()] = bs;
    });

    mergedItems = items.map(item => {
      const itemObj = item.toObject();
      const branchStock = stockMap[item._id.toString()];
      if (branchStock) {
        itemObj.stock = branchStock.stock;
        itemObj.isAvailable = item.isAvailable && branchStock.isAvailable;
        itemObj.branchSpecificStock = branchStock.stock;
      } else if (!item.isGlobal) {
        // If not global and no stock record for this branch, it shouldn't be available
        itemObj.isAvailable = false;
        itemObj.stock = 0;
      }
      return itemObj;
    });
  }

  res.json({
    success: true,
    count: mergedItems.length,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
    data: mergedItems,
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

  const branchStocks = await BranchStock.find({ menuItem: item._id });

  res.json({
    success: true,
    data: {
      ...item.toObject(),
      branchStocks,
    },
  });
});

// @desc    Create a menu item
// @route   POST /api/menu
// @access  Private (Admin, Location Admin)
const createMenuItem = asyncHandler(async (req, res, next) => {
  const {
    name, category, price, costPrice, originalPrice, discountedPrice,
    description, isAvailable, preparationTime, locationId, dietaryType, stock,
    isGlobal, availableBranches
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

  const isGlobalItem = isGlobal === 'on' || isGlobal === 'true' || isGlobal === true;
  let branchIds = [];
  
  if (!isGlobalItem) {
    if (Array.isArray(availableBranches)) {
      branchIds = availableBranches;
    } else if (availableBranches) {
      branchIds = availableBranches.split(',');
    } else if (locationId) {
      branchIds = [locationId];
    }
  }

  // Dietary Validation
  if (!isGlobalItem && branchIds.length > 0) {
    const branches = await Location.find({ _id: { $in: branchIds } });
    for (const branch of branches) {
      if (branch.dietaryType === 'veg' && dietaryType !== 'veg') {
        res.status(400);
        throw new Error(`Branch "${branch.name || branch.city}" is Veg-only. Cannot add non-veg items.`);
      }
      if (branch.dietaryType === 'non-veg' && dietaryType !== 'non-veg') {
        res.status(400);
        throw new Error(`Branch "${branch.name || branch.city}" is Non-Veg only. Cannot add veg items.`);
      }
    }
  }

  const itemData = {
    name,
    category,
    price: Number(price),
    costPrice: costPrice ? Number(costPrice) : 0,
    description,
    isAvailable: isAvailable === 'on' || isAvailable === 'true' || isAvailable === true || isAvailable === undefined,
    preparationTime: preparationTime ? Number(preparationTime) : 10,
    isGlobal: isGlobalItem,
    availableBranches: isGlobalItem ? [] : branchIds,
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

  // Initialize BranchStock for all assigned branches
  if (!isGlobalItem && branchIds.length > 0) {
    const stockDocs = branchIds.map(branchId => {
      const specificStock = req.body[`branchStock_${branchId}`];
      return {
        menuItem: item._id,
        branch: branchId,
        stock: specificStock !== undefined ? Number(specificStock) : (stock ? Number(stock) : 0),
        isAvailable: specificStock !== undefined ? Number(specificStock) > 0 : true
      };
    });
    await BranchStock.insertMany(stockDocs);
  }

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
    description, isAvailable, preparationTime, locationId, dietaryType, stock,
    isGlobal, availableBranches
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
  
  const isGlobalItem = isGlobal !== undefined ? (isGlobal === 'on' || isGlobal === 'true' || isGlobal === true) : item.isGlobal;
  let branchIds = item.availableBranches;

  if (isGlobal !== undefined || availableBranches !== undefined || locationId !== undefined) {
    if (isGlobalItem) {
      branchIds = [];
    } else {
      if (Array.isArray(availableBranches)) {
        branchIds = availableBranches;
      } else if (typeof availableBranches === 'string') {
        branchIds = availableBranches.split(',');
      } else if (locationId) {
        branchIds = [locationId];
      }
    }
  }

  const finalDietaryType = dietaryType || item.dietaryType;

  // Dietary Validation for update
  if (!isGlobalItem && branchIds.length > 0) {
    const branches = await Location.find({ _id: { $in: branchIds } });
    for (const branch of branches) {
      if (branch.dietaryType === 'veg' && finalDietaryType !== 'veg') {
        res.status(400);
        throw new Error(`Branch "${branch.name || branch.city}" is Veg-only. Cannot assign non-veg items.`);
      }
      if (branch.dietaryType === 'non-veg' && finalDietaryType !== 'non-veg') {
        res.status(400);
        throw new Error(`Branch "${branch.name || branch.city}" is Non-Veg only. Cannot assign veg items.`);
      }
    }
  }

  updates.isGlobal = isGlobalItem;
  updates.availableBranches = branchIds;
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

  // Synchronize BranchStock records
  if (updates.isGlobal !== undefined || updates.availableBranches !== undefined) {
    if (updates.isGlobal) {
      // If item becomes global, we can either keep or remove branch stocks. 
      // Usually, global items might use a different inventory logic or we just remove branch-specifics.
      // For now, let's keep it simple: if global, branch-specific stock is ignored.
      await BranchStock.deleteMany({ menuItem: updated._id });
    } else if (updates.availableBranches) {
      // Remove stocks for branches no longer assigned
      await BranchStock.deleteMany({ 
        menuItem: updated._id, 
        branch: { $nin: updates.availableBranches } 
      });
      
      // Add or Update stocks for branches
      for (const branchId of updates.availableBranches) {
        const specificStock = req.body[`branchStock_${branchId}`];
        const stockToSet = specificStock !== undefined ? Number(specificStock) : (stock ? Number(stock) : 0);
        
        await BranchStock.findOneAndUpdate(
          { menuItem: updated._id, branch: branchId },
          { 
            $set: { 
              stock: stockToSet,
              isAvailable: stockToSet > 0
            } 
          },
          { upsert: true, new: true }
        );
      }
    }
  }

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

// @desc    Update menu item stock for a specific branch
// @route   PUT /api/menu/:id/stock
// @access  Private
const updateStock = asyncHandler(async (req, res) => {
  const { stock, branchId } = req.body;
  const item = await MenuItem.findById(req.params.id);

  if (!item) {
    res.status(404);
    throw new Error('Menu item not found');
  }

  if (branchId) {
    const branchStock = await BranchStock.findOneAndUpdate(
      { menuItem: item._id, branch: branchId },
      { stock: Number(stock), isAvailable: Number(stock) > 0 },
      { new: true, upsert: true }
    );
    
    res.json({
      success: true,
      data: branchStock,
      message: `Stock updated for ${item.name} at branch.`,
    });
  } else {
    // Fallback for global stock if no branchId (deprecated behavior)
    item.stock = Number(stock);
    await item.save();
    res.json({
      success: true,
      data: item,
      message: `Global stock updated for ${item.name}`,
    });
  }
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
