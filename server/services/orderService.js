const mongoose = require('mongoose');
const Order = require('../models/Order');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const BranchStock = require('../models/BranchStock');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIO } = require('../config/socket');

// True only when a write failed specifically because the MongoDB deployment
// can't run transactions (standalone server, not a replica set / mongos). Used
// to fall back to a non-atomic order create instead of failing every order.
const isTransactionUnsupportedError = (error) => {
  const msg = (error && error.message ? error.message : '').toLowerCase();
  return (
    msg.includes('transaction numbers are only allowed') ||
    msg.includes('replica set member or mongos') ||
    msg.includes('does not support transactions') ||
    msg.includes('does not support sessions') ||
    msg.includes('transactions are not supported')
  );
};

/**
 * Order Service
 * Handles business logic for orders to keep controllers thin.
 */
class OrderService {
  /**
   * Create a new order with stock deduction and table update.
   *
   * The work spans several writes (stock, order doc, table) so it runs inside a
   * MongoDB transaction for atomicity. Transactions require a replica set /
   * mongos — on a STANDALONE MongoDB the transaction throws and NO order can ever
   * be placed (staff just see "Something went wrong"). Detect that single case
   * and transparently retry the same logic non-atomically, so orders still work.
   */
  async createOrder(params) {
    try {
      return await this._createOrder(params, true);
    } catch (error) {
      if (isTransactionUnsupportedError(error)) {
        return await this._createOrder(params, false);
      }
      throw error;
    }
  }

  async _createOrder({ branch, tableId, items, customerPhone, customerName, discountAmount = 0, couponId = null, paymentType = 'CASH', orderType = 'dine-in', userId, source = 'staff', members = [], numberOfPeople = 0, prepaid = false, amountPaid = 0, paymentStatus = 'unpaid', initialStatus = 'PLACED', paymentApproval = null }, useTransaction = true) {
    const Reservation = require('../models/Reservation');
    const isDineIn = orderType === 'dine-in';

    // session === null → every `.session(session)` / `{ session }` below is a
    // harmless no-op, so the exact same logic runs without a transaction.
    const session = useTransaction ? await mongoose.startSession() : null;
    if (session) session.startTransaction();
    let linkedReservationId = null;

    try {
      // 1. Pre-checks (Rate limiting, Reservations) — only for dine-in (table) orders.
      // Takeaway/delivery have no table, so they skip the per-table guards.
      if (isDineIn && tableId) {
        const tenSecondsAgo = new Date(Date.now() - 10000);
        const recentOrder = await Order.findOne({ table: tableId, createdAt: { $gte: tenSecondsAgo } }).session(session);
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
        }).session(session);

        // The reserved party themselves must be able to order on their table, so
        // we don't block — we LINK the order to the reservation. The advance is
        // then reconciled against this order's bill at completion.
        if (activeReservation) {
          linkedReservationId = activeReservation._id;
        }
      }

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
        // A globally-disabled item is never orderable on ANY path (the branch-stock
        // branch below otherwise skipped this check).
        if (menuItem.isAvailable === false) {
          throw new Error(`Item ${menuItem.name} is currently unavailable.`);
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
            if (!menuItem.isAvailable) {
              throw new Error(`Item ${menuItem.name} is currently unavailable.`);
            }
            // Guarded conditional decrement: only succeeds if enough stock
            // remains, so concurrent orders can never drive global stock negative.
            const updatedGlobal = await MenuItem.findOneAndUpdate(
              { _id: menuItem._id, stock: { $gte: item.quantity } },
              { $inc: { stock: -item.quantity } },
              { new: true, session }
            );
            if (!updatedGlobal) {
              throw new Error(`Insufficient global stock for ${menuItem.name}.`);
            }
          } else {
            throw new Error(`Item ${menuItem.name} has no stock record in this branch.`);
          }
        } else {
          // For recipe items, verify MenuItem is marked available...
          if (!menuItem.isAvailable) {
            throw new Error(`Item ${menuItem.name} is currently deactivated.`);
          }

          // ...and best-effort precheck that there is enough raw-ingredient stock
          // to fulfil the requested quantity. Recipe items aren't unit-deducted at
          // order time (ingredients are deducted on completion), so without this a
          // shortage would silently be clamped to 0 later. Block the sale instead.
          const BranchInventory = require('../models/BranchInventory');
          for (const ingredientInfo of recipe.ingredients) {
            if (!ingredientInfo.ingredient) continue;
            const needed = (ingredientInfo.quantity || 0) * item.quantity;
            if (needed <= 0) continue;
            const inv = await BranchInventory.findOne({
              branch,
              ingredient: ingredientInfo.ingredient
            }).session(session);
            const available = inv ? (inv.stock || 0) : 0;
            if (available < needed) {
              throw new Error(`Insufficient ingredients to prepare ${menuItem.name}.`);
            }
          }
        }

        // Validate selected modifiers against the item's DEFINED groups (iterate the
        // authoritative groups, not the client list) and fold the SERVER-side
        // priceDelta into the unit price. Enforces required / single-select /
        // maxSelections and dedupes labels so a client can't stack repeated or
        // extra (negative-delta) options to underpay. Client prices are ignored.
        const modSnapshot = [];
        let modDelta = 0;
        if (Array.isArray(menuItem.modifierGroups) && menuItem.modifierGroups.length) {
          const clientByGroup = {};
          if (Array.isArray(item.modifiers)) {
            for (const sel of item.modifiers) {
              const gname = sel?.groupName || sel?.group;
              if (!gname || !sel?.label) continue;
              (clientByGroup[gname] = clientByGroup[gname] || new Set()).add(sel.label);
            }
          }
          for (const grp of menuItem.modifierGroups) {
            const wanted = clientByGroup[grp.name] ? [...clientByGroup[grp.name]] : []; // deduped
            let chosen = wanted.map(l => grp.options.find(o => o.label === l)).filter(Boolean);
            if (grp.required && chosen.length === 0) {
              throw new Error(`Please choose ${grp.name} for ${menuItem.name}.`);
            }
            if (grp.selectionType === 'single') chosen = chosen.slice(0, 1);
            else if (grp.maxSelections > 0) chosen = chosen.slice(0, grp.maxSelections);
            for (const opt of chosen) {
              const delta = Number(opt.priceDelta) || 0;
              modSnapshot.push({ groupName: grp.name, label: opt.label, priceDelta: delta });
              modDelta += delta;
            }
          }
        }
        // Honour an active discount (discountedPrice when set below price), matching
        // what the menu/cart shows everywhere else — the server is the price authority.
        const base = (menuItem.discountedPrice != null && menuItem.discountedPrice < menuItem.price)
          ? menuItem.discountedPrice
          : (menuItem.price || 0);
        const effectivePrice = Math.max(0, base + modDelta);

        itemsWithSnapshots.push({
          menuItem: menuItem._id,
          itemName: menuItem.name,
          price: effectivePrice,
          costPrice: menuItem.costPrice || 0,
          quantity: item.quantity,
          notes: item.notes,
          modifiers: modSnapshot,
        });
      }

      const subtotal = itemsWithSnapshots.reduce((acc, item) => acc + (item.price * item.quantity), 0);

      // 3. Coupon finalization (atomic within transaction)
      // Server recomputes discount — never trust client-provided discountAmount
      let finalDiscount = 0;
      let appliedCoupon = couponId || null;
      if (couponId) {
        // Read + validate FIRST; claim the usage LAST (the $inc below). Previously the
        // atomic $inc:{usedCount:1} ran here, BEFORE the min-order/applicability checks
        // — so on the non-transactional (standalone-Mongo) fallback a thrown "minimum
        // not met" left the coupon use permanently consumed for an order never created.
        // Reading first keeps validation side-effect-free.
        const coupon = await Coupon.findOne({ _id: couponId, isActive: true }).session(session || null);
        if (!coupon || (coupon.expiryDate && coupon.expiryDate < new Date())) {
          throw new Error('Coupon is no longer valid');
        }
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

        // Claim the usage LAST, atomically — the only coupon side effect. Still
        // enforces the usage limit + re-checks active/expiry (under the transaction
        // when one is available), and now runs only after all validation has passed.
        const claimed = await Coupon.findOneAndUpdate(
          {
            _id: couponId,
            isActive: true,
            expiryDate: { $gte: new Date() },
            $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }]
          },
          { $inc: { usedCount: 1 } },
          { new: true, session }
        );
        if (!claimed) throw new Error('Coupon usage limit reached');
      }

      // 4. Order Creation
      const cleanMembers = Array.isArray(members)
        ? members.map((m) => (m || '').toString().trim()).filter(Boolean).slice(0, 50)
        : [];
      const order = await Order.create([{
        branch,
        table: tableId || undefined,
        orderType,
        reservationId: linkedReservationId,
        customerPhone,
        customerName,
        members: cleanMembers,
        numberOfPeople: Math.max(0, Math.floor(Number(numberOfPeople) || 0)),
        prepaid: !!prepaid,
        items: itemsWithSnapshots,
        totalAmount: subtotal,
        discountAmount: finalDiscount,
        coupon: appliedCoupon,
        paymentType,
        amountPaid: Math.max(0, Number(amountPaid) || 0),
        paymentStatus: ['unpaid', 'partial', 'paid'].includes(paymentStatus) ? paymentStatus : 'unpaid',
        paymentApproval: paymentApproval || undefined,
        createdBy: userId || undefined,
        source,
        status: initialStatus,
        statusHistory: [{
          status: initialStatus,
          timestamp: new Date(),
          updatedBy: userId || undefined
        }]
      }], { session });

      // 5. Table Update — dine-in only (takeaway/delivery have no table).
      if (tableId) {
        const tableUpdate = {
          status: 'ongoing',
          $inc: { activeOrdersCount: 1 },
        };
        // For a customer self-order, reflect who is seated on the table so staff
        // see the party without opening the order. Only set the name/headcount when
        // the customer supplied them and the table doesn't already have a name.
        if (source !== 'staff') {
          const seatUpdate = {};
          if (customerName) seatUpdate.customerName = customerName;
          if (Number(numberOfPeople) > 0) seatUpdate.numberOfPeople = Math.floor(Number(numberOfPeople));
          seatUpdate.isBooked = true;
          Object.assign(tableUpdate, seatUpdate);
        }
        await Table.findByIdAndUpdate(tableId, tableUpdate, { session, runValidators: false });
      }

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }

      const createdOrder = order[0];

      // Real-time signals
      const io = getIO();
      if (createdOrder.status === 'AWAITING_APPROVAL') {
        // Unconfirmed self-order: alert front-of-house (staff + branch admins/admins
        // + super admins) to review & confirm the payment. The kitchen is NOT told
        // yet — the order only reaches chefs once payment is approved.
        io.to(`branch_${branch}_staff`)
          .to(`branch_${branch}_branch_admin`)
          .to(`branch_${branch}_location_admin`)
          .to(`branch_${branch}_admin`)
          .to('role_super_admin')
          .emit('order:pending_approval', { orderId: createdOrder._id, branchId: branch });
      } else {
        io.to(`branch_${branch}_chef`).emit('order:new', { orderId: createdOrder._id });
        // Scope to THIS branch's admins/branch-admins (+ super_admins who oversee
        // all branches). Previously emitted to global role_admin, leaking other
        // branches' order activity to every admin.
        io.to(`branch_${branch}_admin`).to(`branch_${branch}_branch_admin`).to('role_super_admin').emit('order:new', { orderId: createdOrder._id, branchId: branch });
      }

      return createdOrder;
    } catch (error) {
      if (session) {
        // Guard the abort/end so they can NEVER mask the ORIGINAL error. On a
        // standalone MongoDB the first session write throws "Transaction numbers
        // are only allowed on a replica set member or mongos"; if abortTransaction()
        // then throws its own (different) error, it replaced that original — so the
        // standalone fallback in createOrder() failed to recognize it and EVERY
        // order 500'd. Preserve and rethrow the original error instead.
        try { await session.abortTransaction(); } catch (_) { /* keep original error */ }
        try { session.endSession(); } catch (_) { /* keep original error */ }
      }
      throw error;
    }
  }

  /**
   * Update order status and trigger side effects
   */
  async updateStatus(orderId, status, userId, userRole) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    const branchId = order.branch.toString();
    const io = getIO();

    // COMPLETED is finalized atomically by finalizeOrder (it claims isBilled and
    // sets status/completedAt/history in a single update). Do NOT pre-write the
    // status/history here, or the order gets a duplicate COMPLETED history entry
    // and the loser of a concurrent double-complete persists a phantom COMPLETED.
    if (status === 'COMPLETED') {
      const { finalizeOrder } = require('../utils/orderFinalizer');
      const user = await User.findById(userId);
      await finalizeOrder(order, user);
      await this._handleCustomerCRM(order, userId);
      io.to(`branch_${branchId}`).emit('order:update', { orderId: order._id, status: 'COMPLETED' });
      return order;
    }

    // Auto-assign chef if transitioning to ACCEPTED
    if (status === 'ACCEPTED' && userRole === 'chef') {
      order.assignedChef = userId;
    }

    // Record who served the order on the SERVED transition so we avoid a
    // separate save()+updateStatus() double status write in the controller.
    if (status === 'SERVED') {
      order.servedBy = userId;
    }

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      updatedBy: userId
    });

    await order.save();

    // Real-time notifications
    io.to(`branch_${branchId}`).emit('order:update', { orderId: order._id, status: order.status });

    if (status === 'READY') {
      io.to(`branch_${branchId}_staff`).emit('order:ready', { orderId: order._id, message: 'Order Ready!' });
    }

    return order;
  }

  /**
   * Confirm the payment on a customer self-order (QR/online) that is waiting in
   * AWAITING_APPROVAL, and release it into the kitchen flow (→ PLACED). A staff
   * member does this once they've seen the cash / verified the UPI reference.
   */
  async approvePayment(orderId, { method, amountPaid, upiRef, note, markPaid = true } = {}, user) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (order.status !== 'AWAITING_APPROVAL') {
      throw new Error('This order is not awaiting payment approval');
    }

    const tender = ['CASH', 'UPI'].includes(method)
      ? method
      : (order.paymentApproval?.method || 'CASH');
    const total = Number(order.totalAmount) || 0;
    const paid = markPaid
      ? (amountPaid !== undefined && amountPaid !== null && amountPaid !== '' ? Number(amountPaid) : total)
      : Number(order.amountPaid) || 0;

    order.paymentType = tender;
    order.amountPaid = Math.max(0, Number.isFinite(paid) ? paid : total);
    order.paymentStatus = order.amountPaid <= 0 ? 'unpaid' : (order.amountPaid < total ? 'partial' : 'paid');
    order.prepaid = order.paymentStatus === 'paid';
    order.paymentApproval = {
      status: 'approved',
      method: tender,
      upiRef: upiRef || order.paymentApproval?.upiRef || null,
      note: note || order.paymentApproval?.note || null,
      approvedBy: user?._id || null,
      approvedAt: new Date(),
    };

    order.status = 'PLACED';
    order.statusHistory.push({ status: 'PLACED', timestamp: new Date(), updatedBy: user?._id });
    await order.save();

    const branchId = order.branch.toString();
    const io = getIO();
    // Now the kitchen may see it, and everyone watching the branch gets the update.
    io.to(`branch_${branchId}_chef`).emit('order:new', { orderId: order._id });
    io.to(`branch_${branchId}`).emit('order:update', { orderId: order._id, status: order.status });
    io.to(`branch_${branchId}`).emit('order:approved', { orderId: order._id });

    return order;
  }

  /**
   * Decline a customer self-order awaiting approval (payment not received / wrong).
   * Marks it rejected, restores stock + coupon, and frees the table counter.
   */
  async declinePublicOrder(orderId, reason, user) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (!['AWAITING_APPROVAL', 'PLACED'].includes(order.status)) {
      throw new Error('This order can no longer be declined');
    }

    order.status = 'REJECTED';
    order.rejectReason = reason || 'Payment not received';
    order.paymentApproval = {
      ...(order.paymentApproval ? order.paymentApproval.toObject?.() || order.paymentApproval : {}),
      status: 'rejected',
      approvedBy: user?._id || null,
      approvedAt: new Date(),
      note: reason || order.paymentApproval?.note || null,
    };

    await this._restoreStockForItems(order);
    await this._restoreCouponUsage(order);
    order.statusHistory.push({ status: 'REJECTED', timestamp: new Date(), updatedBy: user?._id });

    if (order.table) {
      await Table.findByIdAndUpdate(order.table, { $inc: { activeOrdersCount: -1 } }, { runValidators: false });
    }
    await order.save();

    const io = getIO();
    io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: 'REJECTED' });
    io.to(`branch_${order.branch}`).emit('order:declined', { orderId: order._id });

    return order;
  }

  /**
   * Internal helper for CRM logic
   */
  async _handleCustomerCRM(order, userId) {
    if (!order.customerPhone) return;

    // A CRM failure must NEVER fail an order that is already finalized/billed.
    // The whole helper is best-effort: errors are logged and swallowed.
    try {
      const Customer = require('../models/Customer');
      const Coupon = require('../models/Coupon');
      const { getSettings } = require('../utils/settings');
      const io = getIO();
      const branchId = order.branch.toString();

      // Configurable loyalty rules for this branch.
      const L = (await getSettings(order.branch)).loyalty;
      const pointsEarned = Math.floor(order.totalAmount / 100) * (Number(L.pointsPer100) || 0);

      // Build atomic $inc payload: visits/spend/points plus per-item favourites.
      const inc = {
        visits: 1,
        totalSpend: order.totalAmount,
        loyaltyPoints: pointsEarned
      };
      order.items.forEach(item => {
        const itemId = item.menuItem?._id?.toString() || item.menuItem?.toString();
        if (itemId) {
          inc[`favoriteItems.${itemId}`] = (inc[`favoriteItems.${itemId}`] || 0) + item.quantity;
        }
      });

      // Atomic upsert — eliminates the findOne -> new -> save race that could
      // lose concurrent visit/spend/point updates or violate the unique phone index.
      const customer = await Customer.findOneAndUpdate(
        { phone: order.customerPhone },
        {
          $inc: inc,
          $set: { lastVisit: new Date() },
          $setOnInsert: {
            name: order.customerName || 'Valued Customer',
            branch: order.branch
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Atomically claim the reward threshold worth of points only if the balance
      // is high enough. The conditional filter guarantees a single concurrent
      // finalize can mint the coupon, never double-spending the points.
      const threshold = Number(L.rewardThresholdPoints) || 100;
      if (customer && customer.loyaltyPoints >= threshold) {
        const claimed = await Customer.findOneAndUpdate(
          { phone: order.customerPhone, loyaltyPoints: { $gte: threshold } },
          { $inc: { loyaltyPoints: -threshold } },
          { new: true }
        );

        if (claimed) {
          const couponCode = `REWARD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + (Number(L.rewardExpiryDays) || 30));

          await Coupon.create({
            code: couponCode,
            discountType: 'fixed',
            discountValue: Number(L.rewardCouponValue) || 100,
            minOrderAmount: Number(L.rewardMinOrder) || 300,
            expiryDate: expiry,
            usageLimit: 1,
            createdBy: userId,
            isActive: true
          });

          io.to(`branch_${branchId}`).emit('customer:reward_unlocked', { phone: claimed.phone, couponCode });
        }
      }
    } catch (error) {
      console.error('[OrderService] CRM/loyalty update failed (order already finalized):', error);
    }
  }

  /**
   * Modify order items with stock delta logic
   */
  async updateItems(orderId, items, userId) {
    const Recipe = require('../models/Recipe');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new Error('Order not found');

      const lockedStatuses = ['PREPARING', 'READY', 'SERVED', 'CANCELLED', 'REJECTED'];
      if (lockedStatuses.includes(order.status)) {
        throw new Error(`Cannot modify order in ${order.status} status`);
      }

      // Compute per-menuItem delta. Convention: positive = quantity removed from
      // the order (restore stock); negative = quantity added (deduct |delta|).
      const itemMap = {};
      order.items.forEach(item => {
        const id = item.menuItem.toString();
        itemMap[id] = (itemMap[id] || 0) + item.quantity;
      });
      items.forEach(item => {
        const id = item.menuItem.toString();
        itemMap[id] = (itemMap[id] || 0) - item.quantity;
      });

      const menuItemIds = Object.keys(itemMap);

      // Recipe items are not unit-deducted at order time, so their stock must
      // never be adjusted here (consistent with create/teardown logic).
      const recipes = await Recipe.find({ menuItemId: { $in: menuItemIds } })
        .select('menuItemId')
        .session(session);
      const recipeSet = new Set(recipes.map(r => r.menuItemId.toString()));

      // Build the rebuilt order snapshots up front (before mutating stock) so a
      // missing menu item aborts cleanly without partial stock changes.
      const menuItems = await MenuItem.find({ _id: { $in: items.map(i => i.menuItem) } }).session(session);
      const menuMap = new Map(menuItems.map(m => [m._id.toString(), m]));

      const updatedItemsWithSnapshots = [];
      let recalculatedTotal = 0;
      for (const item of items) {
        const menuItem = menuMap.get(item.menuItem.toString());
        if (!menuItem) {
          throw new Error(`Item ${item.menuItem} not found.`);
        }
        // Honour an active discount (matches the create path + what the menu shows).
        const unitPrice = (menuItem.discountedPrice != null && menuItem.discountedPrice < menuItem.price)
          ? menuItem.discountedPrice
          : (menuItem.price || 0);
        updatedItemsWithSnapshots.push({
          menuItem: menuItem._id,
          itemName: menuItem.name,
          price: unitPrice,
          costPrice: menuItem.costPrice || 0,
          quantity: item.quantity,
          notes: item.notes
        });
        recalculatedTotal += unitPrice * item.quantity;
      }

      // Apply guarded stock deltas inside the transaction.
      for (const [menuItemId, delta] of Object.entries(itemMap)) {
        if (delta === 0) continue;
        if (recipeSet.has(menuItemId)) continue; // recipe items: no unit stock

        if (delta < 0) {
          // Quantity increased -> deduct. Guard with stock:{$gte:needed} so we
          // can never drive stock negative; no upsert (a missing record means
          // the item isn't stocked at this branch and the deduction must fail).
          const needed = -delta;
          const updated = await BranchStock.findOneAndUpdate(
            { menuItem: menuItemId, branch: order.branch, stock: { $gte: needed } },
            { $inc: { stock: -needed } },
            { new: true, session, runValidators: true }
          );
          if (!updated) {
            throw new Error('Insufficient stock for one or more items. Adjustment failed.');
          }
          updated.isAvailable = updated.stock > 0;
          await updated.save({ session });
        } else {
          // Quantity reduced -> restore. Only touch an existing record (no upsert).
          const updated = await BranchStock.findOneAndUpdate(
            { menuItem: menuItemId, branch: order.branch },
            { $inc: { stock: delta }, $set: { isAvailable: true } },
            { new: true, session, runValidators: true }
          );
          // If no branch record exists the original deduction was global/none —
          // leave it untouched rather than fabricating a branch stock row.
        }
      }

      order.items = updatedItemsWithSnapshots;
      order.totalAmount = recalculatedTotal;
      // Re-clamp any previously applied discount so it can never exceed the new
      // (possibly smaller) total — otherwise reducing items leaves a stale coupon
      // discount that pushes the payable amount negative.
      if (order.discountAmount) {
        order.discountAmount = Math.min(order.discountAmount, recalculatedTotal);
      }
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      const io = getIO();
      io.to(`branch_${order.branch}`).emit('order:update', { orderId: order._id, status: order.status });

      return order;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  /**
   * Restore unit stock for an order's items on teardown (reject/cancel/delete).
   *
   * IMPORTANT: recipe items are NOT unit-deducted at order time (their raw
   * ingredients are only deducted on completion), so we must NOT inflate stock
   * for them here. We only restore items that were actually deducted at create:
   *   - non-recipe items with a BranchStock record -> restore BranchStock
   *   - non-recipe global items (no BranchStock record) -> restore MenuItem.stock
   */
  async _restoreStockForItems(order, session = null) {
    const Recipe = require('../models/Recipe');
    const menuItemIds = order.items.map(i => i.menuItem);

    const recipeQuery = Recipe.find({ menuItemId: { $in: menuItemIds } }).select('menuItemId');
    const menuQuery = MenuItem.find({ _id: { $in: menuItemIds } }).select('_id isGlobal');
    if (session) { recipeQuery.session(session); menuQuery.session(session); }
    const [recipes, menuItems] = await Promise.all([recipeQuery, menuQuery]);

    const recipeSet = new Set(recipes.map(r => r.menuItemId.toString()));
    const globalSet = new Set(menuItems.filter(m => m.isGlobal).map(m => m._id.toString()));

    for (const item of order.items) {
      const idStr = item.menuItem.toString();
      // Recipe items were never unit-deducted — skip.
      if (recipeSet.has(idStr)) continue;

      const branchStock = await BranchStock.findOneAndUpdate(
        { menuItem: item.menuItem, branch: order.branch },
        { $inc: { stock: item.quantity }, $set: { isAvailable: true } },
        session ? { session } : {}
      );

      // No branch stock record but global -> it was deducted from MenuItem.stock.
      if (!branchStock && globalSet.has(idStr)) {
        await MenuItem.findByIdAndUpdate(
          item.menuItem,
          { $inc: { stock: item.quantity } },
          session ? { session } : {}
        );
      }
    }
  }

  /**
   * Give back a coupon use when an order that consumed it is cancelled / rejected
   * / refunded. _createOrder does `$inc: { usedCount: 1 }`; without this, a
   * single-use coupon stays permanently burned by an order that never completed.
   * Guarded at usedCount > 0 so it can never go negative.
   */
  async _restoreCouponUsage(order, session = null) {
    if (!order.coupon) return;
    await Coupon.updateOne(
      { _id: order.coupon, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
      session ? { session } : {}
    );
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

    await this._restoreStockForItems(order);
    await this._restoreCouponUsage(order);

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
    await this._restoreStockForItems(order);
    await this._restoreCouponUsage(order);
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
      await this._restoreStockForItems(order);
      // Active order being deleted still holds its coupon use (cancel/reject paths
      // already gave theirs back, and are excluded above) — return it.
      await this._restoreCouponUsage(order);
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
