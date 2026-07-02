const MenuItem = require('../models/MenuItem');
const Location = require('../models/Location');
const BranchStock = require('../models/BranchStock');
const asyncHandler = require('../utils/asyncHandler');
const sendNotification = require('../utils/sendNotification');
const { logAction } = require('../utils/auditLogger');
const { clampLimit, enforceLocationAccess, canAccessLocation, userLocationIds } = require('../utils/accessControl');

// Parse + sanitize modifier groups (sent as JSON, or a JSON string via FormData).
// Drops malformed entries so a bad payload can't corrupt the menu item.
const parseModifierGroups = (raw) => {
  if (raw === undefined || raw === null || raw === '') return undefined; // untouched
  let groups = raw;
  if (typeof raw === 'string') {
    try { groups = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(groups)) return [];
  return groups
    .map((g) => ({
      name: (g?.name || '').toString().trim(),
      selectionType: g?.selectionType === 'multiple' ? 'multiple' : 'single',
      required: !!g?.required,
      maxSelections: Math.max(0, Number(g?.maxSelections) || 0),
      options: Array.isArray(g?.options)
        ? g.options
            .map((o) => ({ label: (o?.label || '').toString().trim(), priceDelta: Number(o?.priceDelta) || 0 }))
            .filter((o) => o.label)
        : [],
    }))
    .filter((g) => g.name && g.options.length > 0);
};

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

  // Location scoping — non-super users always scoped to accessible branches
  const role = req.user.role;
  const isSuper = role === 'super_admin';
  const validLocationId = locationId && locationId !== 'all' && locationId !== 'undefined' && locationId !== 'null';

  if (validLocationId) {
    enforceLocationAccess(req, res, locationId, 'You do not have permission to view menu for this branch');
    filter.$or = [{ isGlobal: true }, { availableBranches: locationId }];
  } else if (!isSuper) {
    // Default scope to accessible/assigned branches when no locationId provided.
    // ALWAYS constrain: when the user has zero accessible branches, an empty $in
    // matches nothing, so they see only global items — NOT every cafe's menu. The
    // previous `if (ids.length > 0)` guard skipped scoping entirely on empty access,
    // leaking all branches' menu + cost/margin data.
    const ids = userLocationIds(req.user);
    filter.$or = [{ isGlobal: true }, { availableBranches: { $in: ids } }];
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
      } else {
        // Fallback: If no branch-specific record, use global item settings
        // This prevents items from "disappearing" if a stock record hasn't been created yet.
        itemObj.stock = item.isGlobal ? item.stock : 0;
        itemObj.isAvailable = item.isAvailable; 
      }
      return itemObj;
    });
  }

  // Hide the internal cost price from staff/chef (margin data).
  const canSeeCost = !['staff', 'chef'].includes(req.user.role);
  const data = mergedItems.map((it) => {
    const o = it.toObject ? it.toObject() : it;
    if (!canSeeCost) delete o.costPrice;
    return o;
  });

  res.json({
    success: true,
    count: data.length,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    },
    data,
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

  // Non-super users may only view global items or items available to one of
  // their branches — otherwise cross-branch metadata/costs would leak.
  if (req.user.role !== 'super_admin' && !item.isGlobal) {
    const owns = (item.availableBranches || []).some((b) => canAccessLocation(req.user, b.toString()));
    if (!owns) {
      res.status(403);
      throw new Error('You do not have permission to view this menu item');
    }
  }

  const stockQuery = { menuItem: item._id };
  if (req.user.role !== 'super_admin') {
    const ids = userLocationIds(req.user);
    if (ids.length > 0) stockQuery.branch = { $in: ids };
  }
  const branchStocks = await BranchStock.find(stockQuery);

  const data = { ...item.toObject(), branchStocks };
  if (['staff', 'chef'].includes(req.user.role)) delete data.costPrice;
  res.json({ success: true, data });
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

  // Only super_admin can create global menu items
  const isGlobalItem = (isGlobal === 'on' || isGlobal === 'true' || isGlobal === true) && (req.user.role === 'super_admin' || req.user.permissions?.manageGlobalMenu === true);
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

  if (req.user.role !== 'super_admin' && branchIds.length > 0) {
    const unauthorized = branchIds.some(id => !canAccessLocation(req.user, id));
    if (unauthorized) {
      res.status(403);
      throw new Error('You do not have permission to assign menu items to one or more of these branches');
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

  const parsedModifiers = parseModifierGroups(req.body.modifierGroups);
  if (parsedModifiers !== undefined) itemData.modifierGroups = parsedModifiers;

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

  await sendNotification({
    title: 'Menu Item Created',
    message: `Menu item "${item.name}" was created by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
  });

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

  // A user who cannot manage global items must not edit one — otherwise the
  // logic below would silently demote it from global to branch-scoped.
  const canManageGlobal = req.user.role === 'super_admin' || req.user.permissions?.manageGlobalMenu === true;
  if (item.isGlobal && !canManageGlobal) {
    res.status(403);
    throw new Error('Only users who can manage the global menu may edit a global item');
  }

  // A non-super actor must own the item's CURRENT branch to edit it — otherwise
  // they could hijack another branch's item (e.g. by reassigning it to their own).
  if (req.user.role !== 'super_admin' && !item.isGlobal) {
    const owns = (item.availableBranches || []).some((b) => canAccessLocation(req.user, b.toString()));
    if (!owns) {
      res.status(403);
      throw new Error('You can only edit menu items for your own branch');
    }
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
  const parsedModifiers = parseModifierGroups(req.body.modifierGroups);
  if (parsedModifiers !== undefined) updates.modifierGroups = parsedModifiers;

  // Non-super_admin cannot make items global (or keep them global)
  const canBeGlobal = req.user.role === 'super_admin' || req.user.permissions?.manageGlobalMenu === true;
  const isGlobalItem = isGlobal !== undefined
    ? ((isGlobal === 'on' || isGlobal === 'true' || isGlobal === true) && canBeGlobal)
    : (item.isGlobal && canBeGlobal);
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

  if (req.user.role !== 'super_admin' && branchIds.length > 0) {
    const unauthorized = branchIds.some(id => !canAccessLocation(req.user, id));
    if (unauthorized) {
      res.status(403);
      throw new Error('You do not have permission to assign menu items to one or more of these branches');
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

        if (!Number.isFinite(stockToSet) || stockToSet < 0) {
          res.status(400);
          throw new Error('Branch stock must be a number of 0 or more');
        }

        await BranchStock.findOneAndUpdate(
          { menuItem: updated._id, branch: branchId },
          {
            $set: {
              stock: stockToSet,
              isAvailable: stockToSet > 0
            }
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
      }
    }
  }

  await logAction(req, 'MENU_ITEM_UPDATE', `Updated menu item: ${updated.name}`);

  await sendNotification({
    title: 'Menu Item Updated',
    message: `Menu item "${updated.name}" was updated by ${req.user.name}.`,
    type: 'activity',
    performedByUser: req.user,
  });

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

  // Non-super_admin can only delete items assigned to their accessible branches
  if (req.user.role !== 'super_admin') {
    if (item.isGlobal && req.user.permissions?.manageGlobalMenu !== true) {
      res.status(403);
      throw new Error('Only Super Admins can delete global menu items');
    }
    const ids = userLocationIds(req.user);
    const hasAccess = item.availableBranches?.some(b => ids.includes(b.toString()));
    if (!hasAccess) {
      res.status(403);
      throw new Error('You do not have permission to delete this menu item');
    }
  }

  await item.deleteOne();

  await logAction(req, 'MENU_ITEM_DELETE', `Deleted menu item: ${item.name}`);

  await sendNotification({
    title: 'Menu Item Deleted',
    message: `Menu item "${item.name}" was deleted by ${req.user.name}.`,
    type: 'activity',
    priority: 'high',
    performedByUser: req.user,
  });

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

  const role = req.user.role;
  // staff/chef toggle branch-stock availability only — never the global item flag
  if (role === 'staff' || role === 'chef') {
    const branchId = req.user.assignedLocation?.toString();
    if (!branchId) {
      res.status(400);
      throw new Error('No assigned branch found for this user');
    }
    const branchStock = await BranchStock.findOneAndUpdate(
      { menuItem: item._id, branch: branchId },
      [{ $set: { isAvailable: { $not: '$isAvailable' } } }],
      { new: true, upsert: true }
    );
    await sendNotification({
      title: 'Availability Toggled',
      message: `Availability for menu item "${item.name}" was toggled by ${req.user.name}.`,
      type: 'activity',
      priority: 'low',
      performedByUser: req.user,
      locationId: branchStock.branch,
    });
    return res.json({
      success: true,
      data: branchStock,
      message: `Item marked as ${branchStock.isAvailable ? 'available' : 'unavailable'} for your branch`,
    });
  }

  // Admins toggle the global flag (but should have branch ownership already)
  if (req.user.role !== 'super_admin' && item.isGlobal) {
    res.status(403);
    throw new Error('Only Super Admins can toggle availability of global menu items');
  }

  // A non-super actor may only toggle a branch item that belongs to one of their branches.
  if (req.user.role !== 'super_admin' && !item.isGlobal) {
    const owns = (item.availableBranches || []).some((b) => canAccessLocation(req.user, b.toString()));
    if (!owns) {
      res.status(403);
      throw new Error('You can only toggle menu items for your own branch');
    }
  }

  item.isAvailable = !item.isAvailable;
  await item.save();

  await sendNotification({
    title: 'Availability Toggled',
    message: `Availability for menu item "${item.name}" was toggled by ${req.user.name}.`,
    type: 'activity',
    priority: 'low',
    performedByUser: req.user,
  });

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
  const { stock } = req.body;
  const branchId = req.body.branchId ||
    (['staff', 'branch_admin', 'location_admin', 'chef'].includes(req.user.role)
      ? req.user.assignedLocation?.toString()
      : null);

  const item = await MenuItem.findById(req.params.id);

  if (!item) {
    res.status(404);
    throw new Error('Menu item not found');
  }

  const numStock = Number(stock);
  if (!Number.isFinite(numStock) || numStock < 0) {
    res.status(400);
    throw new Error('Stock must be a number of 0 or more');
  }

  if (branchId) {
    enforceLocationAccess(req, res, branchId, 'You do not have permission to update stock for this branch');
    const branchStock = await BranchStock.findOneAndUpdate(
      { menuItem: item._id, branch: branchId },
      { stock: numStock, isAvailable: numStock > 0 },
      { new: true, upsert: true }
    );

    await sendNotification({
      title: 'Stock Updated',
      message: `Stock for menu item "${item.name}" was updated by ${req.user.name}.`,
      type: 'activity',
      priority: 'low',
      performedByUser: req.user,
      locationId: branchId,
    });

    res.json({
      success: true,
      data: branchStock,
      message: `Stock updated for ${item.name} at branch.`,
    });
  } else {
    // Fallback for global stock if no branchId (deprecated behavior)
    item.stock = numStock;
    await item.save();

    await sendNotification({
      title: 'Stock Updated',
      message: `Global stock for menu item "${item.name}" was updated by ${req.user.name}.`,
      type: 'activity',
      priority: 'low',
      performedByUser: req.user,
    });

    res.json({
      success: true,
      data: item,
      message: `Global stock updated for ${item.name}`,
    });
  }
});

// @desc    Increment / decrement branch stock by a delta (quick +/- controls)
// @route   PATCH /api/menu/:id/stock/adjust
// @access  Private
const adjustStock = asyncHandler(async (req, res) => {
  const delta = Math.trunc(Number(req.body.delta));
  if (!Number.isFinite(delta) || delta === 0) {
    res.status(400);
    throw new Error('A non-zero whole-number delta is required');
  }

  const branchId = req.body.branchId ||
    (['staff', 'branch_admin', 'location_admin', 'chef'].includes(req.user.role)
      ? req.user.assignedLocation?.toString()
      : null);

  const item = await MenuItem.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Menu item not found');
  }

  if (branchId) {
    enforceLocationAccess(req, res, branchId, 'You do not have permission to update stock for this branch');

    // Read-modify-write so we can clamp at zero (a decrement can never drive stock
    // negative) and derive availability from the resulting quantity.
    const existing = await BranchStock.findOne({ menuItem: item._id, branch: branchId });
    const current = existing ? Number(existing.stock) || 0 : 0;
    const next = Math.max(0, current + delta);

    const branchStock = await BranchStock.findOneAndUpdate(
      { menuItem: item._id, branch: branchId },
      { $set: { stock: next, isAvailable: next > 0 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      data: branchStock,
      message: `${item.name}: stock ${delta > 0 ? 'increased' : 'decreased'} to ${next}.`,
    });
  }

  // Global item fallback (no branch context).
  const nextGlobal = Math.max(0, (Number(item.stock) || 0) + delta);
  item.stock = nextGlobal;
  await item.save();
  res.json({
    success: true,
    data: item,
    message: `${item.name}: global stock set to ${nextGlobal}.`,
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
  adjustStock,
};
