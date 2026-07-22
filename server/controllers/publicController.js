const asyncHandler = require('../utils/asyncHandler');
const crypto = require('crypto');
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Location = require('../models/Location');
const Table = require('../models/Table');
const Order = require('../models/Order');
const BranchStock = require('../models/BranchStock');
const Recipe = require('../models/Recipe');
const Reservation = require('../models/Reservation');
const OrderService = require('../services/orderService');
const { getSettings } = require('../utils/settings');
const { normalizePhone } = require('../utils/phone');
const { signCustomerToken, verifyCustomerToken } = require('../utils/customerToken');

const safeTokenEquals = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const assertValidTableQrToken = (res, table, token) => {
  if (!table?.publicOrderToken || !token || !safeTokenEquals(table.publicOrderToken, token)) {
    res.status(403);
    throw new Error('Invalid table QR link. Please scan the latest QR code.');
  }
};

// Which tables at a branch are FREE to order on right now: status 'available', not
// flagged booked, and not covered by a confirmed reservation active at this moment
// (a full-location reservation blocks every table). Used so the scan page can tell a
// guest their scanned table is taken and offer the free ones instead.
const getBranchTableAvailability = async (branchId) => {
  const now = new Date();
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const [tables, activeReservations] = await Promise.all([
    Table.find({ locationId: branchId })
      .select('tableNumber tableName capacity status isBooked publicOrderToken')
      .sort({ tableNumber: 1 })
      .lean(),
    Reservation.find({
      locationId: branchId,
      date: today,
      status: 'confirmed',
      startTime: { $lte: currentTimeStr },
      endTime: { $gte: currentTimeStr },
    }).select('reservationType tableIds').lean(),
  ]);

  const fullLocationReserved = activeReservations.some((r) => r.reservationType === 'full-location');
  const reservedSet = new Set();
  activeReservations.forEach((r) => (r.tableIds || []).forEach((id) => reservedSet.add(id.toString())));

  const isFree = (t) =>
    !fullLocationReserved &&
    t.status === 'available' &&
    !t.isBooked &&
    !reservedSet.has(t._id.toString());

  const freeTables = tables
    .filter(isFree)
    .map((t) => ({
      _id: t._id,
      tableNumber: t.tableNumber,
      tableName: t.tableName || '',
      capacity: t.capacity || 1,
      qrToken: t.publicOrderToken,
    }));

  return { tables, freeTables, isFree, fullLocationReserved };
};

// PUBLIC, UNAUTHENTICATED endpoints for customer QR / online self-ordering.
// Everything is validated server-side; prices, stock and modifier deltas come
// from the database (never from the client), and rate limiting is applied at the
// route layer.

// Only the payment fields the customer needs — never leak internal config.
const publicPayments = (settings) => ({
  upiVpa: settings.payments?.upiVpa || '',
  upiName: settings.payments?.upiName || '',
  acceptUpi: settings.payments?.acceptUpi !== false && !!settings.payments?.upiVpa,
  acceptCash: settings.payments?.acceptCash !== false,
  requireApproval: settings.payments?.requireApprovalForQr !== false,
});

// Sibling of publicPayments: only the CRM bits the scan page needs to decide
// whether to show the first-visit sheet. Never leaks the discount economics of
// other cafes/branches.
const publicCrm = (settings) => ({
  askProfileOnScan: settings.crm?.askProfileOnScan !== false,
  profileRequired: settings.crm?.profileRequired === true,
});

// ── Customer identity (public scan flow) ─────────────────────────────────────
// Everything below is deliberately token-gated: there is NO endpoint that maps a
// bare phone number to a profile, because that would let anyone enumerate numbers
// and harvest names, emails and dates of birth.

// Show a customer only the last 4 digits of their own number back.
const maskOwnPhone = (phone) => {
  const d = String(phone || '');
  return d.length <= 4 ? d : `••••••${d.slice(-4)}`;
};

const publicProfile = (customer) => ({
  name: customer.name || '',
  phone: maskOwnPhone(customer.phone),
  gender: customer.gender || null,
  dob: customer.dob || null,
  email: customer.email || null,
  dobLocked: !!customer.dobLockedAt,
});

// The intro offer for THIS customer at THIS branch. Computed from the resolved
// crm settings (DEFAULTS < global < cafe < branch) AND the membership, so it is
// zero the moment the customer has already ordered at this cafe.
const computeOffer = (settings, membership) => {
  const crm = settings.crm || {};
  const eligible = crm.newCustomerDiscountEnabled !== false
    && (!membership || (membership.status === 'new' && !membership.newCustomerDiscountUsed));
  const percent = eligible ? Number(crm.newCustomerDiscountPercent) || 0 : 0;
  return {
    discountPercent: percent,
    maxDiscount: crm.newCustomerMaxDiscount ?? null,
    minOrder: Number(crm.newCustomerMinOrder) || 0,
    label: percent > 0 ? `${percent}% off your first order here` : '',
  };
};

// Resolve the branch (and its cafe) for a public request, mirroring the exact
// active-branch check used by getPublicMenu / createPublicOrder.
/**
 * A blocked cafe stops serving guests as well as staff. Without this, customers
 * could keep scanning QR codes and placing orders into a cafe nobody can log in
 * to and nobody is watching.
 */
const assertCafeServing = async (res, cafeId) => {
  if (!cafeId) return;
  const { getSuspendedCafes } = require('../utils/tenantStatus');
  const suspended = await getSuspendedCafes();
  if (suspended.has(String(cafeId))) {
    res.status(403);
    const err = new Error('This cafe is not accepting orders right now. Please ask a member of staff.');
    err.code = 'CAFE_SUSPENDED';
    throw err;
  }
};

const resolvePublicBranch = async (res, branchId) => {
  if (!mongoose.isValidObjectId(branchId)) {
    res.status(400);
    throw new Error('A valid branch is required');
  }
  const branch = await Location.findById(branchId).select('_id status cafe').lean();
  if (!branch || branch.status === 'deleted' || branch.status === 'inactive') {
    res.status(404);
    throw new Error('Branch not found');
  }
  await assertCafeServing(res, branch.cafe);
  return branch;
};

const membershipFor = (customer, cafeId) => {
  if (!customer || !cafeId) return null;
  return (customer.memberships || []).find((m) => String(m.cafe) === String(cafeId)) || null;
};

// @desc    Recognise a returning customer from their opaque token
// @route   GET /api/public/customer/me?token=&branchId=
const getPublicCustomerMe = asyncHandler(async (req, res) => {
  const { token, branchId } = req.query;
  const customerId = verifyCustomerToken(token);
  if (!customerId) return res.json({ success: true, data: { known: false } });

  const Customer = require('../models/Customer');
  const customer = await Customer.findById(customerId).lean();
  if (!customer) return res.json({ success: true, data: { known: false } });

  const branch = await resolvePublicBranch(res, branchId);
  const settings = await getSettings(branch._id);
  const membership = membershipFor(customer, branch.cafe);

  res.json({
    success: true,
    data: {
      known: true,
      profile: publicProfile(customer),
      membership: {
        status: membership?.status || 'new',
        isNewHere: !membership || membership.status === 'new',
      },
      offer: computeOffer(settings, membership),
      crm: publicCrm(settings),
    },
  });
});

// @desc    First-visit registration (or re-linking an existing number)
// @route   POST /api/public/customer/profile
const upsertPublicCustomerProfile = asyncHandler(async (req, res) => {
  const { branchId, tableId, qrToken, name, phone, gender, dob, email } = req.body || {};

  const branch = await resolvePublicBranch(res, branchId);

  // If they scanned a table, the QR must be the current one — same guarantee the
  // ordering endpoint enforces, so a stale/forged QR can't register against a table.
  if (tableId) {
    if (!mongoose.isValidObjectId(tableId)) {
      res.status(400);
      throw new Error('Invalid table');
    }
    const table = await Table.findOne({ _id: tableId, locationId: branch._id }).select('publicOrderToken');
    if (!table) {
      res.status(400);
      throw new Error('Invalid table');
    }
    assertValidTableQrToken(res, table, qrToken);
  }

  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 10) {
    res.status(400);
    throw new Error('Please enter a valid 10-digit mobile number');
  }
  const cleanName = String(name || '').trim().slice(0, 120);
  if (!cleanName) {
    res.status(400);
    throw new Error('Please enter your name');
  }

  const allowedGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
  const cleanGender = allowedGenders.includes(gender) ? gender : null;

  let cleanEmail = null;
  if (email) {
    cleanEmail = String(email).trim().toLowerCase().slice(0, 160);
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      res.status(400);
      throw new Error('Please enter a valid email address');
    }
  }

  let cleanDob = null;
  if (dob) {
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) {
      res.status(400);
      throw new Error('Please enter a valid date of birth');
    }
    const years = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (d.getTime() > Date.now() || years < 5 || years > 120) {
      res.status(400);
      throw new Error('Please enter a valid date of birth');
    }
    cleanDob = d;
  }

  const Customer = require('../models/Customer');
  const now = new Date();

  const set = { name: cleanName, profileCompletedAt: now };
  if (cleanGender) set.gender = cleanGender;
  if (cleanEmail) set.email = cleanEmail;

  const setOnInsert = { branch: branch._id, source: 'qr' };
  // dob is write-once: only offer it on INSERT here. An existing customer with a
  // locked dob would otherwise trip the model's immutability guard on every scan.
  const existing = await Customer.findOne({ phone: cleanPhone }).select('dobLockedAt').lean();
  if (cleanDob && !existing?.dobLockedAt) set.dob = cleanDob;

  const upsert = { $set: set, $setOnInsert: setOnInsert };

  let customer;
  const doUpsert = () => Customer.findOneAndUpdate(
    { phone: cleanPhone },
    upsert,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  try {
    customer = await doUpsert();
  } catch (err) {
    if (err && err.code === 11000) customer = await doUpsert();
    else throw err;
  }

  // Ensure a membership for this cafe, and record the branch they scanned at.
  if (branch.cafe) {
    await Customer.updateOne(
      { _id: customer._id, 'memberships.cafe': { $ne: branch.cafe } },
      {
        $push: {
          memberships: {
            cafe: branch.cafe,
            status: 'new',
            branches: [branch._id],
            firstBranch: branch._id,
            joinedAt: now,
          },
        },
      }
    );
    await Customer.updateOne(
      { _id: customer._id, 'memberships.cafe': branch.cafe },
      { $addToSet: { 'memberships.$.branches': branch._id } }
    );
    customer = await Customer.findById(customer._id).lean();
  } else {
    customer = customer.toObject ? customer.toObject() : customer;
  }

  // First-time QR signup → fire the "welcome" WhatsApp automation if one is set.
  // Best-effort: fireWelcome never throws and no-ops when WhatsApp isn't configured.
  if (!existing) {
    const { fireWelcome } = require('../services/whatsappAutomation');
    await fireWelcome(customer);
  }

  const settings = await getSettings(branch._id);
  const membership = membershipFor(customer, branch.cafe);

  res.status(201).json({
    success: true,
    data: {
      customerToken: signCustomerToken(customer._id),
      profile: publicProfile(customer),
      membership: {
        status: membership?.status || 'new',
        isNewHere: !membership || membership.status === 'new',
      },
      offer: computeOffer(settings, membership),
    },
  });
});

// @desc    Edit own details. DOB is rejected once locked.
// @route   PATCH /api/public/customer/profile
const patchPublicCustomerProfile = asyncHandler(async (req, res) => {
  const { token, branchId, name, gender, email, phone, dob } = req.body || {};
  const customerId = verifyCustomerToken(token);
  if (!customerId) {
    res.status(401);
    throw new Error('Please register again to edit your details');
  }

  const Customer = require('../models/Customer');
  const customer = await Customer.findById(customerId);
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  if (dob !== undefined && dob !== null && dob !== '') {
    if (customer.dobLockedAt) {
      res.status(400);
      throw new Error('Date of birth cannot be changed once set');
    }
    const d = new Date(dob);
    const years = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() || years < 5 || years > 120) {
      res.status(400);
      throw new Error('Please enter a valid date of birth');
    }
    customer.dob = d;
  }

  if (name !== undefined) {
    const cleanName = String(name || '').trim().slice(0, 120);
    if (!cleanName) {
      res.status(400);
      throw new Error('Please enter your name');
    }
    customer.name = cleanName;
  }
  if (gender !== undefined) {
    const allowed = ['male', 'female', 'other', 'prefer_not_to_say'];
    customer.gender = allowed.includes(gender) ? gender : null;
  }
  if (email !== undefined) {
    if (!email) customer.email = null;
    else {
      const cleanEmail = String(email).trim().toLowerCase().slice(0, 160);
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        res.status(400);
        throw new Error('Please enter a valid email address');
      }
      customer.email = cleanEmail;
    }
  }
  if (phone !== undefined) {
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 10) {
      res.status(400);
      throw new Error('Please enter a valid 10-digit mobile number');
    }
    if (cleanPhone !== customer.phone) {
      // Never silently merge two identities — the other row may have its own
      // spend/points history belonging to a different human.
      const clash = await Customer.findOne({ phone: cleanPhone }).select('_id').lean();
      if (clash && String(clash._id) !== String(customer._id)) {
        res.status(409);
        throw new Error('That number is already registered');
      }
      customer.phone = cleanPhone;
    }
  }

  await customer.save();

  let offer = { discountPercent: 0, maxDiscount: null, minOrder: 0, label: '' };
  let membership = null;
  if (branchId && mongoose.isValidObjectId(branchId)) {
    const branch = await Location.findById(branchId).select('_id cafe').lean();
    if (branch) {
      const settings = await getSettings(branch._id);
      membership = membershipFor(customer.toObject(), branch.cafe);
      offer = computeOffer(settings, membership);
    }
  }

  res.json({
    success: true,
    data: {
      profile: publicProfile(customer),
      membership: {
        status: membership?.status || 'new',
        isNewHere: !membership || membership.status === 'new',
      },
      offer,
    },
  });
});

// @desc    Remember that the customer dismissed the first-visit sheet.
// @route   POST /api/public/customer/skip
const skipPublicCustomerProfile = asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  const customerId = verifyCustomerToken(token);
  // No token => no customer row is created. Dismissing a form must never
  // manufacture a ghost customer.
  if (customerId) {
    const Customer = require('../models/Customer');
    await Customer.updateOne({ _id: customerId }, { $set: { skippedAt: new Date() } });
  }
  res.json({ success: true, data: { ok: true } });
});

// Top items for a branch over the last 45 days, from orders that actually reached
// the kitchen (so a table full of unconfirmed/rejected self-orders can't skew it).
const getPopularItems = async (branchId, limit = 6) => {
  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  try {
    const rows = await Order.aggregate([
      {
        $match: {
          branch: new mongoose.Types.ObjectId(branchId),
          status: { $in: ['PREPARING', 'READY', 'SERVED', 'COMPLETED'] },
          createdAt: { $gte: since },
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.menuItem': { $ne: null } } },
      {
        $group: {
          _id: '$items.menuItem',
          name: { $last: '$items.itemName' },
          count: { $sum: '$items.quantity' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r) => ({ menuItem: r._id, name: r.name, count: r.count }));
  } catch (e) {
    return [];
  }
};

// @desc    Public menu for a branch (read-only) + optional table + payment config
// @route   GET /api/public/menu?branchId=&tableId=
const getPublicMenu = asyncHandler(async (req, res) => {
  const { branchId, tableId } = req.query;
  const tableQrToken = req.query.token || req.query.qrToken;
  if (!mongoose.isValidObjectId(branchId)) {
    res.status(400);
    throw new Error('A valid branch is required');
  }
  const branch = await Location.findById(branchId).select('name city status cafe');
  if (!branch || branch.status === 'deleted' || branch.status === 'inactive') {
    res.status(404);
    throw new Error('Branch not found');
  }
  await assertCafeServing(res, branch.cafe);

  // Resolve the scanned table (if any) so the scan page can greet the guest, cap the
  // party size to the table's real capacity, and — if the table is already taken —
  // tell the guest and offer the branch's currently-free tables to pick instead.
  let table = null;
  let freeTables = [];
  if (tableId && mongoose.isValidObjectId(tableId)) {
    const avail = await getBranchTableAvailability(branchId);
    freeTables = avail.freeTables;
    const t = avail.tables.find((x) => x._id.toString() === tableId.toString());
    if (!t) {
      res.status(404);
      throw new Error('Table not found');
    }
    assertValidTableQrToken(res, t, tableQrToken);
    if (t) {
      table = {
        _id: t._id,
        tableNumber: t.tableNumber,
        tableName: t.tableName || '',
        capacity: t.capacity || 1,
        status: t.status,
        available: avail.isFree(t), // false → already booked/reserved right now
        qrToken: t.publicOrderToken,
      };
    }
  }

  const [rawItems, settings, popular] = await Promise.all([
    MenuItem.find({
      isAvailable: true,
      $or: [{ isGlobal: true }, { availableBranches: branchId }],
    })
      .populate('category', 'name icon')
      .select('name price discountedPrice image description category dietaryType modifierGroups isGlobal stock recipeId')
      .lean(),
    getSettings(branchId),
    getPopularItems(branchId),
  ]);

  // Merge per-branch stock so the customer sees live quantities, and DROP anything
  // that can't actually be ordered right now (out of stock / not stocked here).
  const ids = rawItems.map((i) => i._id);
  const [branchStocks, recipes] = await Promise.all([
    BranchStock.find({ branch: branchId, menuItem: { $in: ids } }).select('menuItem stock isAvailable').lean(),
    Recipe.find({ menuItemId: { $in: ids } }).select('menuItemId').lean(),
  ]);
  const stockMap = new Map(branchStocks.map((s) => [s.menuItem.toString(), s]));
  const recipeSet = new Set(recipes.map((r) => r.menuItemId.toString()));

  const items = [];
  for (const it of rawItems) {
    const idStr = it._id.toString();
    const bs = stockMap.get(idStr);
    const isRecipe = recipeSet.has(idStr) || it.recipeId != null;

    let orderable = false;
    let stock = null;      // number of units left, when the item is stock-tracked
    let tracksStock = false;

    if (bs) {
      tracksStock = true;
      stock = bs.stock;
      orderable = bs.isAvailable !== false && bs.stock > 0;
    } else if (isRecipe) {
      // Made-to-order (ingredient-based) — no unit stock to show.
      orderable = true;
    } else if (it.isGlobal) {
      tracksStock = true;
      stock = it.stock || 0;
      orderable = (it.stock || 0) > 0;
    } else {
      // Not stocked at this branch → can't be ordered here.
      orderable = false;
    }

    if (!orderable) continue; // hide out-of-stock / unavailable items entirely

    const { isGlobal, stock: _s, recipeId, ...pub } = it;
    items.push({ ...pub, tracksStock, ...(tracksStock ? { stock } : {}) });
  }

  res.json({
    success: true,
    data: {
      branch: { _id: branch._id, name: branch.name, city: branch.city },
      table,
      freeTables, // available tables to offer when the scanned table is taken
      payments: publicPayments(settings),
      crm: publicCrm(settings),
      popular,
      items,
    },
  });
});

// @desc    Place a customer self-order (QR / online)
// @route   POST /api/public/order
const createPublicOrder = asyncHandler(async (req, res) => {
  const {
    branchId, tableId, orderType, items,
    customerName, customerPhone, members, numberOfPeople,
    paymentChoice, payLaterMethod, upiRef, qrToken,
    // Opaque identity token from a previous scan. Used ONLY to look the customer
    // up server-side — the browser can never send a discount.
    customerToken,
  } = req.body || {};

  if (!mongoose.isValidObjectId(branchId)) {
    res.status(400);
    throw new Error('A valid branch is required');
  }
  // Mirror the public menu's check: an inactive (closed/deactivated) branch must
  // not accept orders either. Previously only 'deleted' was rejected here, so a
  // customer could still place an order at a branch whose menu refuses to load.
  const branch = await Location.findById(branchId).select('_id status cafe');
  if (!branch || branch.status === 'deleted' || branch.status === 'inactive') {
    res.status(404);
    throw new Error('Branch not found');
  }
  await assertCafeServing(res, branch.cafe);
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Your cart is empty');
  }
  // Hard cap to keep a public endpoint from being abused with huge payloads.
  if (items.length > 50) {
    res.status(400);
    throw new Error('Too many items in one order');
  }
  const cleanCustomerName = (customerName || 'Guest').toString().trim().slice(0, 120) || 'Guest';
  const cleanCustomerPhone = (customerPhone || '').toString().replace(/\D/g, '').slice(0, 15);
  if (customerPhone && cleanCustomerPhone.length < 10) {
    res.status(400);
    throw new Error('Please provide a valid phone number');
  }

  const type = ['dine-in', 'takeaway'].includes(orderType) ? orderType : (tableId ? 'dine-in' : 'takeaway');

  // For dine-in, the table must exist AND belong to this branch.
  let tableDoc = null;
  if (type === 'dine-in') {
    if (!mongoose.isValidObjectId(tableId)) {
      res.status(400);
      throw new Error('A valid table is required for dine-in');
    }
    tableDoc = await Table.findOne({ _id: tableId, locationId: branchId }).select('_id capacity publicOrderToken');
    if (!tableDoc) {
      res.status(400);
      throw new Error('That table does not belong to this branch');
    }
    assertValidTableQrToken(res, tableDoc, qrToken);
  }

  // Party members + headcount, clamped to the table capacity.
  const capacity = tableDoc?.capacity || 50;
  const cleanMembers = Array.isArray(members)
    ? members.map((m) => (m || '').toString().trim().slice(0, 80)).filter(Boolean).slice(0, capacity)
    : [];
  let people = Math.floor(Number(numberOfPeople) || 0);
  if (people < 0) people = 0;
  people = Math.min(people, capacity);
  if (cleanMembers.length > people) people = cleanMembers.length;

  // Normalize items — only pass menuItem id, quantity, notes, modifiers; the
  // service looks up authoritative prices/stock/modifier deltas itself.
  const cleanItems = items
    .filter((i) => i && mongoose.isValidObjectId(i.menuItem) && Number(i.quantity) > 0)
    .map((i) => ({
      menuItem: i.menuItem,
      quantity: Math.min(99, Math.max(1, Math.floor(Number(i.quantity)))),
      notes: (i.notes || '').toString().slice(0, 200),
      modifiers: Array.isArray(i.modifiers) ? i.modifiers.slice(0, 20) : [],
    }));
  if (cleanItems.length === 0) {
    res.status(400);
    throw new Error('No valid items in the order');
  }

  // Re-validate every item against the SAME filter the public menu uses: available
  // and assigned to this branch. The order endpoint must not accept items the
  // customer was never shown (cross-branch / disabled / off-menu ids).
  const allowed = await MenuItem.find({
    _id: { $in: cleanItems.map((i) => i.menuItem) },
    isAvailable: true,
    $or: [{ isGlobal: true }, { availableBranches: branchId }],
  }).select('_id').lean();
  const allowedSet = new Set(allowed.map((i) => i._id.toString()));
  if (cleanItems.some((i) => !allowedSet.has(i.menuItem.toString()))) {
    res.status(400);
    throw new Error('One or more items are not available at this branch');
  }

  // Payment intent. The customer either prepays now via UPI, or elects to settle
  // at the counter later (cash or UPI). Either way the order waits for a staff
  // member to confirm the money before it is sent to the kitchen (unless the
  // branch has turned approval off in settings).
  const settings = await getSettings(branchId);
  const pay = publicPayments(settings);

  const wantsUpiNow = paymentChoice === 'pay_now_upi';
  if (wantsUpiNow && !pay.acceptUpi) {
    res.status(400);
    throw new Error('UPI payment is not enabled for this branch');
  }
  const laterMethod = ['CASH', 'UPI'].includes(payLaterMethod) ? payLaterMethod : 'CASH';
  if (!wantsUpiNow && laterMethod === 'CASH' && !pay.acceptCash) {
    res.status(400);
    throw new Error('Cash payment is not accepted at this branch');
  }

  const method = wantsUpiNow ? 'UPI' : laterMethod;
  const requireApproval = pay.requireApproval;
  const initialStatus = requireApproval ? 'AWAITING_APPROVAL' : 'PLACED';
  const paymentApproval = {
    status: requireApproval ? 'pending' : 'not_required',
    method,
    upiRef: (upiRef || '').toString().slice(0, 40) || null,
    note: wantsUpiNow ? 'Customer marked UPI paid — verify reference' : (method === 'CASH' ? 'Pay cash at counter' : 'Pay UPI at counter'),
    approvedBy: null,
    approvedAt: null,
  };

  // ── New-customer intro discount, computed SERVER-SIDE ──────────────────────
  // The browser may send a customerToken, never a discount. We resolve the
  // customer ourselves, confirm the membership for this cafe is still 'new' with
  // an unclaimed offer, and derive the rupee amount from the branch's settings.
  let serverDiscountAmount = 0;
  let resolvedCustomerId = null;
  try {
    const tokenCustomerId = verifyCustomerToken(customerToken);
    if (tokenCustomerId) {
      const Customer = require('../models/Customer');
      const branchDoc = await Location.findById(branchId).select('cafe').lean();
      const known = await Customer.findById(tokenCustomerId).lean();
      if (known) {
        resolvedCustomerId = known._id;
        const membership = membershipFor(known, branchDoc?.cafe);
        const offer = computeOffer(settings, membership);
        if (offer.discountPercent > 0) {
          const subtotal = cleanItems.reduce(
            (acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0),
            0
          );
          if (subtotal >= (offer.minOrder || 0)) {
            let amount = (subtotal * offer.discountPercent) / 100;
            if (offer.maxDiscount != null) amount = Math.min(amount, Number(offer.maxDiscount) || 0);
            serverDiscountAmount = Number(Math.max(0, amount).toFixed(2));
          }
        }
      }
    }
  } catch (err) {
    // A CRM lookup must never block a customer from ordering.
    console.error('[publicController] intro-discount resolution failed:', err.message);
  }

  const order = await OrderService.createOrder({
    branch: branchId,
    tableId: type === 'dine-in' ? tableId : null,
    items: cleanItems,
    customerName: cleanCustomerName,
    customerPhone: cleanCustomerPhone,
    members: cleanMembers,
    numberOfPeople: people,
    orderType: type,
    paymentType: method,
    serverDiscountAmount,
    prepaid: false, // becomes true only once staff confirm a full UPI prepayment
    userId: null,
    source: 'qr',
    initialStatus,
    paymentApproval,
  });

  // Stamp the identity now so the order is attributable even before completion.
  if (resolvedCustomerId && order?._id) {
    await Order.updateOne({ _id: order._id }, { $set: { customerId: resolvedCustomerId } });
  }

  const message = requireApproval
    ? (wantsUpiNow
        ? 'Order received! We are confirming your UPI payment — please wait a moment.'
        : 'Order received! Please pay at the counter; our staff will confirm it shortly.')
    : 'Order placed! Thank you.';

  res.status(201).json({
    success: true,
    data: {
      orderId: order._id,
      status: order.status,
      approvalStatus: order.paymentApproval?.status || 'not_required',
      total: order.totalAmount,
      method,
    },
    message,
  });
});

// @desc    Lightweight status probe so the scan page can show "confirmed" live
// @route   GET /api/public/order/:id
const getPublicOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { branchId } = req.query;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(branchId)) {
    res.status(400);
    throw new Error('Invalid order');
  }
  // Bind the lookup to the branch the customer scanned. Without this, an anonymous
  // caller could iterate ObjectIds and read the status/total of ANY order in ANY
  // branch or cafe (cross-tenant enumeration). The scan page already knows branchId
  // from the QR, so this is transparent to the real customer.
  const order = await Order.findOne({ _id: id, branch: branchId })
    .select('status paymentApproval.status paymentStatus totalAmount')
    .lean();
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  res.json({
    success: true,
    data: {
      status: order.status,
      approvalStatus: order.paymentApproval?.status || 'not_required',
      paymentStatus: order.paymentStatus,
      confirmed: !['AWAITING_APPROVAL', 'REJECTED', 'CANCELLED'].includes(order.status),
      declined: ['REJECTED', 'CANCELLED'].includes(order.status),
    },
  });
});

module.exports = {
  getPublicMenu,
  createPublicOrder,
  getPublicOrderStatus,
  getPublicCustomerMe,
  upsertPublicCustomerProfile,
  patchPublicCustomerProfile,
  skipPublicCustomerProfile,
};
