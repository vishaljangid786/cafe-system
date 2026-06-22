const mongoose = require('mongoose');
const Order = require('../models/Order');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const BranchStock = require('../models/BranchStock');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIO } = require('../config/socket');

/**
 * Order Service
 * Handles business logic for orders to keep controllers thin.
 */
class OrderService {
  /**
   * Create a new order with stock deduction and table update
   */
  async createOrder({ branch, tableId, items, customerPhone, customerName, discountAmount = 0, couponId = null, userId }) {
    const Reservation = require('../models/Reservation');

    // 1. Pre-checks (Rate limiting, Reservations)
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const recentOrder = await Order.findOne({ table: tableId, createdAt: { $gte: tenSecondsAgo } });
    if (recentOrder) {
      throw new Error('Please wait 10 seconds before placing another order for this table.');
    }

    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const currentTimeStr = `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;

    const activeReservation = await Reservation.findOne({
      locationId: branch,
      date: today,
      status: 'confirmed',
      $or: [
        { reservationType: 'full-location' },
        { tableIds: tableId }
      ],
      startTime: { $lte: currentTimeStr },
      endTime: { $gte: currentTimeStr }
    });

    if (activeReservation) {
      throw new Error(`This table is currently reserved for "${activeReservation.eventName}".`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Stock Validation & Deduction
      const menuItemIds = items.map(i => i.menuItem);
      const [branchStocks, menuItems, recipes] = await Promise.all([
        BranchStock.find({ menuItem: { $in: menuItemIds }, branch }).session(session),
        MenuItem.find({ _id: { $in: menuItemIds } }).session(session),
        require('../models/Recipe').find({ menuItemId: { $in: menuItemIds } }).session(session)
      ]);

      const stockMap = new Map(branchStocks.map(s => [s.menuItem.toString(), s]));
      const menuMap = new Map(menuItems.map(m => [m._id.toString(), m]));
      const recipeMap = new Map(recipes.map(r => [r.menuItemId.toString(), r]));

      const itemsWithSnapshots = [];
      for (const item of items) {
        const branchStock = stockMap.get(item.menuItem.toString());
        const menuItem = menuMap.get(item.menuItem.toString());
        const recipe = recipeMap.get(item.menuItem.toString());

        if (!menuItem) {
          throw new Error(`Item ${item.menuItem} not found.`);
        }

        // Logic Change: If it's a Recipe Item, we don't deduct unit stock now.
        // It will be deducted from ingredients on completion.
        // If it's a Stocked Item (no recipe), we deduct from BranchStock now.
        if (!recipe) {
          if (branchStock) {
            if (branchStock.stock < item.quantity) {
              throw new Error(`Insufficient stock for ${menuItem.name}.`);
            }
            if (!branchStock.isAvailable) {
              throw new Error(`Item ${menuItem.name} is currently unavailable.`);
            }
            branchStock.stock -= item.quantity;
            if (branchStock.stock <= 0) branchStock.isAvailable = false;
            await branchStock.save({ session });
          } else if (menuItem.isGlobal) {
            if (menuItem.stock < item.quantity) {
              throw new Error(`Insufficient global stock for ${menuItem.name}.`);
            }
            if (!menuItem.isAvailable) {
              throw new Error(`Item ${menuItem.name} is currently unavailable.`);
            }
            await MenuItem.findByIdAndUpdate(menuItem._id, { $inc: { stock: -item.quantity } }, { session });
          } else {
            throw new Error(`Item ${menuItem.name} has no stock record in this branch.`);
          }
        } else {
          // For recipe items, we just verify MenuItem is marked available
          if (!menuItem.isAvailable) {
            throw new Error(`Item ${menuItem.name} is currently deactivated.`);
          }
        }

        itemsWithSnapshots.push({
          menuItem: menuItem._id,
          itemName: menuItem.name,
          price: menuItem.price,
          costPrice: menuItem.costPrice || 0,
          quantity: item.quantity,
          notes: item.notes
        });
      }

      const subtotal = itemsWithSnapshots.reduce((acc, item) => acc + (item.price * item.quantity), 0);

      // 3. Coupon finalization (atomic within transaction)
      // Server recomputes discount — never trust client-provided discountAmount
      let finalDiscount = 0;
      let appliedCoupon = couponId || null;
      if (couponId) {
        const coupon = await Coupon.findOneAndUpdate(
          {
            _id: couponId,
            isActive: true,
            expiryDate: { $gte: new Date() },
            $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }]
          },
          { $inc: { usedCount: 1 } },
          { new: true, session }
        );
        if (!coupon) throw new Error('Coupon is no longer valid or usage limit reached');
        appliedCoupon = coupon._id;

        // Enforce min order amount
        if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
          throw new Error(`Order minimum of ${coupon.minOrderAmount} not met for this coupon`);
        }

        // Enforce item/category applicability
        if (coupon.appliesTo?.items?.length > 0) {
          const applicableItemIds = new Set(coupon.appliesTo.items.map(id => id.toString()));
          const eligibleSubtotal = itemsWithSnapshots
            .filter(i => applicableItemIds.has(i.menuItem.toString()))
            .reduce((acc, i) => acc + i.price * i.quantity, 0);
          finalDiscount = coupon.discountType === 'percentage'
            ? (eligibleSubtotal * coupon.discountValue) / 100
            : Math.min(coupon.discountValue, eligibleSubtotal);
        } else if (coupon.appliesTo?.categories?.length > 0) {
          const catIds = new Set(coupon.appliesTo.categories.map(id => id.toString()));
          const itemIds = itemsWithSnapshots.map(i => i.menuItem.toString());
          const itemDocs = await MenuItem.find({ _id: { $in: itemIds } }).select('_id category').lean();
          const catMap = new Map(itemDocs.map(d => [d._id.toString(), d.category?.toString()]));
          const eligibleSubtotal = itemsWithSnapshots
            .filter(i => catIds.has(catMap.get(i.menuItem.toString())))
            .reduce((acc, i) => acc + i.price * i.quantity, 0);
          finalDiscount = coupon.discountType === 'percentage'
            ? (eligibleSubtotal * coupon.discountValue) / 100
            : Math.min(coupon.discountValue, eligibleSubtotal);
        } else {
          // Applies to full order
          finalDiscount = coupon.discountType === 'percentage'
            ? (subtotal * coupon.discountValue) / 100
            : Math.min(coupon.discountValue, subtotal);
        }

        // Cap at maxDiscount if set
        if (coupon.maxDiscount && finalDiscount > coupon.maxDiscount) {
          finalDiscount = coupon.maxDiscount;
        }
        finalDiscount = Math.min(finalDiscount, subtotal); // cannot exceed subtotal
        finalDiscount = Number(finalDiscount.toFixed(2));
      }

      // 4. Order Creation
      const order = await Order.create([{
        branch,
        table: tableId,
        customerPhone,
        customerName,
        items: itemsWithSnapshots,
        totalAmount: subtotal,
        discountAmount: finalDiscount,
        coupon: appliedCoupon,
        createdBy: userId,
        status: 'PLACED',
        statusHistory: [{
          status: 'PLACED',
          timestamp: new Date(),
          updatedBy: userId
        }]
      }], { session });

      // 5. Table Update
      await Table.findByIdAndUpdate(tableId, {
        status: 'ongoing',
        $inc: { activeOrdersCount: 1 }
      }, { session, runValidators: false });

      await session.commitTransaction();
      session.endSession();

      const createdOrder = order[0];
      
      // Real-time signals
      const io = getIO();
      io.to(`branch_${branch}_chef`).emit('order:new', { orderId: createdOrder._id });
      io.to('role_admin').to('role_super_admin').emit('order:new', { orderId: createdOrder._id, branchId: branch });

      return createdOrder;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  /**
   * Update order status and trigger side effects
   */
  async updateStatus(orderId, status, userId, userRole) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    // Auto-assign chef if transitioning to ACCEPTED
    if (status === 'ACCEPTED' && userRole === 'chef') {
      order.assignedChef = userId;
    }

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      updatedBy: userId
    });

    if (status === 'COMPLETED') {
      order.completedAt = new Date();
    }

    await order.save();

    const io = getIO();
    const branchId = order.branch.toString();

    // Real-time notifications
    io.to(`branch_${branchId}`).emit('order:update', { orderId: order._id, status: order.status });

    if (status === 'READY') {
      io.to(`branch_${branchId}_staff`).emit('order:ready', { orderId: order._id, message: 'Order Ready!' });
    }

    if (status === 'COMPLETED') {
      const { finalizeOrder } = require('../utils/orderFinalizer');
      // Note: passing dummy user if not provided, but userId is available
      const user = await User.findById(userId);
      await finalizeOrder(order, user);
      
      await this._handleCustomerCRM(order, userId);
    }

    return order;
  }

  /**
   * Internal helper for CRM logic
   */
  async _handleCustomerCRM(order, userId) {
    if (!order.customerPhone) return;

    const Customer = require('../models/Customer');
    const Coupon = require('../models/Coupon');
    const io = getIO();
    const branchId = order.branch.toString();
    
    let customer = await Customer.findOne({ phone: order.customerPhone });
    if (!customer) {
      customer = new Customer({
        phone: order.customerPhone,
        name: order.customerName || 'Valued Customer',
        branch: order.branch
      });
    }

    customer.visits += 1;
    customer.totalSpend += order.totalAmount;
    customer.lastVisit = new Date();
    
    const pointsEarned = Math.floor(order.totalAmount / 100);
    customer.loyaltyPoints += pointsEarned;

    order.items.forEach(item => {
      const itemId = item.menuItem?._id?.toString() || item.menuItem?.toString();
      if (itemId) {
        const currentCount = customer.favoriteItems.get(itemId) || 0;
        customer.favoriteItems.set(itemId, currentCount + item.quantity);
      }
    });

    if (customer.loyaltyPoints >= 100) {
      customer.loyaltyPoints -= 100;
      const couponCode = `REWARD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);

      await Coupon.create({
        code: couponCode,
        discountType: 'fixed',
        discountValue: 100,
        minOrderAmount: 300,
        expiryDate: expiry,
        usageLimit: 1,
        createdBy: userId,
        isActive: true
      });
      
      io.to(`branch_${branchId}`).emit('customer:reward_unlocked', { phone: customer.phone, couponCode });
    }

    await customer.save();
  }

  /**
   * Modify order items with stock delta logic
   */
  async updateItems(orderId, items, userId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    const lockedStatuses = ['PREPARING', 'READY', 'SERVED', 'CANCELLED', 'REJECTED'];
    if (lockedStatuses.includes(order.status)) {
      throw new Error(`Cannot modify order in ${order.status} status`);
    }

    // Stock Adjustment Logic
    const oldItems = order.items;
    const newItems = items;
    const itemMap = {};

    oldItems.forEach(item => {
      const id = item.menuItem.toString();
      itemMap[id] = (itemMap[id] || 0) + item.quantity;
    });

    newItems.forEach(item => {
      const id = item.menuItem.toString();
      itemMap[id] = (itemMap[id] || 0) - item.quantity;
    });

    for (const [menuItemId, delta] of Object.entries(itemMap)) {
      if (delta < 0) {
        const needed = Math.abs(delta);
        const branchStock = await BranchStock.findOne({ menuItem: menuItemId, branch: order.branch });
        if (branchStock && branchStock.stock < needed) {
          throw new Error(`Insufficient stock for one or more items. Adjustment failed.`);
        }
      }
    }

    for (const [menuItemId, delta] of Object.entries(itemMap)) {
      if (delta !== 0) {
        const updatedStock = await BranchStock.findOneAndUpdate(
          { menuItem: menuItemId, branch: order.branch },
          { $inc: { stock: delta } },
          { new: true, upsert: true }
        );

        if (updatedStock) {
          updatedStock.isAvailable = updatedStock.stock > 0;
          await updatedStock.save();
        }
      }
    }

    const updatedItemsWithSnapshots = [];
    let recalculatedTotal = 0;

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItem);
      if (menuItem) {
        updatedItemsWithSnapshots.push({
          menuItem: menuItem._id,
          itemName: menuItem.name,
          price: menuItem.price,
          costPrice: menuItem.costPrice || 0,
          quantity: item.quantity,
          notes: item.notes
        });
        recalculatedTotal += menuItem.price * item.quantity;
      }
    }

    order.items = updatedItemsWithSnapshots;
    order.totalAmount = recalculatedTotal;
    await order.save();

    const io = getIO();
    io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: order.status });

    return order;
  }

  /**
   * Reject order and restore stock
   */
  async rejectOrder(orderId, rejectReason, userId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    order.status = 'REJECTED';
    order.rejectReason = rejectReason;
    order.assignedChef = userId;

    for (const item of order.items) {
      await BranchStock.findOneAndUpdate(
        { menuItem: item.menuItem, branch: order.branch },
        { $inc: { stock: item.quantity }, isAvailable: true }
      );
    }

    order.statusHistory.push({
      status: 'REJECTED',
      timestamp: new Date(),
      updatedBy: userId
    });

    await Table.findByIdAndUpdate(order.table, { $inc: { activeOrdersCount: -1 } }, { runValidators: false });
    await order.save();

    const io = getIO();
    io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: 'REJECTED' });

    return order;
  }

  /**
   * Cancel order and restore stock
   */
  async cancelOrder(orderId, userId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    order.status = 'CANCELLED';
    for (const item of order.items) {
      await BranchStock.findOneAndUpdate(
        { menuItem: item.menuItem, branch: order.branch },
        { $inc: { stock: item.quantity }, isAvailable: true }
      );
    }
    order.statusHistory.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      updatedBy: userId
    });

    await Table.findByIdAndUpdate(order.table, { $inc: { activeOrdersCount: -1 } }, { runValidators: false });
    await order.save();

    const io = getIO();
    io.to(`branch_${order.branch}`).emit('order:cancel', { orderId: order._id });

    return order;
  }

  /**
   * Delete order and handle stock restoration if needed
   */
  async deleteOrder(orderId, userRole) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (order.status === 'COMPLETED') {
      throw new Error('Cannot delete a completed order');
    }

    if (!['CANCELLED', 'REJECTED', 'COMPLETED'].includes(order.status)) {
      for (const item of order.items) {
        await BranchStock.findOneAndUpdate(
          { menuItem: item.menuItem, branch: order.branch },
          { $inc: { stock: item.quantity }, isAvailable: true }
        );
      }
      await Table.findByIdAndUpdate(order.table, { $inc: { activeOrdersCount: -1 } }, { runValidators: false });
    }

    await order.deleteOne();
    const io = getIO();
    io.to(`branch_${order.branch}`).emit('order:delete', { orderId: order._id });

    return true;
  }

  /**
   * Add chef note and dispatch notifications
   */
  async addChefNote(orderId, chefNote, user) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    order.chefNote = chefNote;
    await order.save();

    await this._dispatchChefNoteNotifications(order, chefNote, user);

    const io = getIO();
    io.to(`branch_${order.branch}`).emit('order:note', { orderId: order._id, chefNote });
    io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: order.status });

    return order;
  }

  /**
   * Internal helper for notifications
   */
  async _dispatchChefNoteNotifications(order, chefNote, user) {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const message = `Chef left a note on Order #${order._id.toString().slice(-6).toUpperCase()}: "${chefNote}"`;
    
    const duplicate = await Notification.findOne({
      title: 'New Chef Note',
      message,
      sender: user._id,
      createdAt: { $gte: oneMinuteAgo }
    });

    if (duplicate) return;

    const recipients = [];
    if (order.createdBy) recipients.push({ user: order.createdBy, isRead: false });
    
    const [branchAdmins, admins, supers] = await Promise.all([
      User.find({
        role: 'branch_admin',
        $or: [{ assignedLocation: order.branch }, { accessibleLocations: order.branch }]
      }),
      User.find({ role: 'admin', accessibleLocations: order.branch }),
      User.find({ role: 'super_admin' })
    ]);

    branchAdmins.forEach(u => recipients.push({ user: u._id, isRead: false }));
    admins.forEach(u => recipients.push({ user: u._id, isRead: false }));
    supers.forEach(u => recipients.push({ user: u._id, isRead: false }));

    const uniqueRecipients = [];
    const seen = new Set();
    recipients.forEach(r => {
      const idStr = r.user.toString();
      if (!seen.has(idStr) && idStr !== user._id.toString()) {
        seen.add(idStr);
        uniqueRecipients.push(r);
      }
    });

    if (uniqueRecipients.length > 0) {
      const notification = await Notification.create({
        title: 'New Chef Note',
        message,
        type: 'message',
        priority: 'medium',
        sender: user._id,
        recipients: uniqueRecipients
      });

      const io = getIO();
      uniqueRecipients.forEach(r => {
        io.to(r.user.toString()).emit('new_notification', {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          priority: notification.priority,
          createdAt: notification.createdAt,
          sender: { name: user.name, role: user.role, profileImageUrl: user.profileImageUrl }
        });
      });
    }
  }
}

module.exports = new OrderService();
