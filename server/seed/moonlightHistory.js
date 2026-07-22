/**
 * Moon Light Cafe — 30-day sample HISTORY.
 *
 * Runs AFTER seedMoonlightCafe() (which builds the structure: users, cafe,
 * branches, menu, tables, stock) and fills every operational module with
 * realistic demo data so no dashboard or report is empty:
 *
 *   customers · orders · revenue transactions · expenses · attendance ·
 *   payroll · cash-drawer sessions · reservations · waitlist · feedback ·
 *   gift cards · coupons · notifications · ingredients + branch inventory ·
 *   suppliers + purchase orders
 *
 * Everything is inserted with bulk insertMany calls (timestamps:false where
 * documents are backdated) so the whole run stays fast enough for serverless.
 */

const mongoose = require('mongoose');

const User = require('../models/User');
const Location = require('../models/Location');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const CashSession = require('../models/CashSession');
const Reservation = require('../models/Reservation');
const Waitlist = require('../models/Waitlist');
const Feedback = require('../models/Feedback');
const GiftCard = require('../models/GiftCard');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const Ingredient = require('../models/Ingredient');
const BranchInventory = require('../models/BranchInventory');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');

const DAYS = 30;

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dayStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const CUSTOMER_NAMES = [
  'Aarav Sharma', 'Isha Verma', 'Kabir Singh', 'Tara Kulkarni', 'Dev Patel',
  'Mira Joshi', 'Vivaan Gupta', 'Anaya Reddy', 'Reyansh Iyer', 'Sara Khan',
  'Advait Naik', 'Pihu Agarwal', 'Arnav Desai', 'Riya Chawla', 'Ishaan Bose',
  'Navya Menon', 'Yash Thakur', 'Kiara Malhotra', 'Om Prakash', 'Zoya Sheikh',
  'Ayaan Mirza', 'Diya Pillai', 'Rudra Jadhav', 'Aisha Shaikh', 'Vihaan Rao',
  'Myra Sinha', 'Krish Bhatt', 'Anvi Kapoor', 'Shaurya Saxena', 'Ira Nambiar',
  'Atharv Kale', 'Avni Sood', 'Laksh Arora', 'Nitara Ghosh', 'Veer Chauhan', 'Amaira Das',
];

const FEEDBACK_COMMENTS = [
  'Loved the coffee, will come again!',
  'Service was quick and friendly.',
  'Food took a little long but tasted great.',
  'Cozy ambience, perfect for work.',
  'The croissant was fresh out of the oven. Amazing.',
  'A bit crowded on weekends, otherwise great.',
  'Best filter coffee in the area.',
  'Staff was very courteous.',
  'Portion size could be better for the price.',
  'Clean tables, fast billing. Nice experience.',
];

const EXPENSE_CATS = ['Inventory', 'Electricity', 'Water', 'Maintenance', 'Marketing', 'Rent'];

// Expense.proofImage is a required field (every real expense has a receipt).
const RECEIPT_PLACEHOLDER = 'https://placehold.co/600x800/1f2937/e5e7eb.png?text=Receipt';

const seedMoonlightHistory = async ({ cafe, locations, superAdmin, admin, branchAdmins, staff, chefs }) => {
  console.log('[seed] Moon Light history — starting.');
  const now = new Date();

  // Structure lookups from the base seed.
  const menuItems = await MenuItem.find().lean();
  const tables = await Table.find().lean();

  const idOf = (v) => (v?._id || v).toString();
  const menuAt = (bId) =>
    menuItems.filter((m) => (m.availableBranches || []).some((b) => b.toString() === bId));
  const tablesAt = (bId) => tables.filter((t) => t.locationId.toString() === bId);
  const staffAt = (bId) => staff.filter((s) => idOf(s.assignedLocation) === bId);
  const chefsAt = (bId) => chefs.filter((c) => idOf(c.assignedLocation) === bId);
  const adminAt = (bId) => branchAdmins.find((a) => idOf(a.assignedLocation) === bId) || admin;

  // ---------------------------------------------------------------- Customers
  // Each customer gets a per-cafe MEMBERSHIP (cafe + the branch(es) they visit),
  // because that is what the CRM report reads for the "Cafes / Branches" column.
  // Every few customers touch a second branch, so multi-branch enrolment shows.
  let phoneSeq = 9700000000;
  const customerDocs = CUSTOMER_NAMES.map((name, i) => {
    const primary = locations[i % locations.length];
    const second = locations[(i + 1) % locations.length];
    const multi = i % 3 === 0 && locations.length > 1 && String(primary._id) !== String(second._id);
    const branchIds = multi ? [primary._id, second._id] : [primary._id];
    const totalSpend = rand(500, 12000);
    const visits = rand(1, 18);
    const loyaltyPoints = rand(0, 600);
    const lastVisit = new Date(now.getTime() - rand(0, DAYS) * 86400000);
    return {
      name,
      phone: String(++phoneSeq),
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      loyaltyPoints,
      totalSpend,
      visits,
      lastVisit,
      branch: primary._id,
      memberships: [{
        cafe: cafe._id,
        status: 'existing',
        branches: branchIds,
        firstBranch: primary._id,
        joinedAt: lastVisit,
        firstOrderAt: lastVisit,
        lastVisit,
        orderCount: visits,
        totalSpend,
        loyaltyPoints,
      }],
    };
  });
  const customers = await Customer.insertMany(customerDocs);
  const customersAt = (bId) => customers.filter((c) => c.branch.toString() === bId);

  // ------------------------------------------- Orders + revenue transactions
  // cashByBranchDay feeds the cash-drawer sessions below so the drawer maths
  // (expected cash vs counted) reconciles with the seeded CASH orders.
  const orderDocs = [];
  const txDocs = [];
  const cashByBranchDay = new Map();

  for (const loc of locations) {
    const bId = loc._id.toString();
    const bMenu = menuAt(bId);
    const bTables = tablesAt(bId);
    const bStaff = staffAt(bId);
    const bChefs = chefsAt(bId);

    for (let d = 0; d < DAYS; d++) {
      const perDay = rand(5, 9);
      for (let n = 0; n < perDay; n++) {
        const when = new Date(now);
        when.setDate(now.getDate() - d);
        when.setHours(rand(9, 21), rand(0, 59), 0, 0);
        if (when > now) when.setHours(now.getHours() - 1);

        const cust = pick(customersAt(bId));
        const waiter = pick(bStaff);
        const chef = pick(bChefs);
        const isDineIn = Math.random() < 0.75;

        const items = [];
        let totalAmt = 0;
        let totalCost = 0;
        for (let j = 0, nItems = rand(1, 4); j < nItems; j++) {
          const mi = pick(bMenu);
          const qty = rand(1, 3);
          items.push({
            menuItem: mi._id,
            itemName: mi.name,
            price: mi.price,
            costPrice: mi.costPrice || Math.round(mi.price * 0.4),
            quantity: qty,
            status: 'served',
          });
          totalAmt += mi.price * qty;
          totalCost += (mi.costPrice || Math.round(mi.price * 0.4)) * qty;
        }
        const tax = Math.round(totalAmt * 0.05);
        const grand = totalAmt + tax;
        // CASH and UPI are the only methods the ordering flow actually offers
        // (see the POS/table billing screens), so seeding CARD produced payments
        // the app can never create — they surfaced as a mystery "OTHER" slice.
        const paymentType = pick(['CASH', 'CASH', 'UPI', 'UPI', 'UPI']);

        // Today keeps a few live orders; history is completed with a small
        // cancelled share so cancel-rate widgets have something to show.
        const roll = Math.random();
        const status = d === 0 && roll < 0.3 ? pick(['PLACED', 'PREPARING', 'READY'])
          : roll < 0.08 ? 'CANCELLED'
          : 'COMPLETED';
        const done = status === 'COMPLETED';

        orderDocs.push({
          _id: new mongoose.Types.ObjectId(),
          branch: loc._id,
          orderType: isDineIn ? 'dine-in' : 'takeaway',
          table: isDineIn ? pick(bTables)._id : undefined,
          customerName: cust.name,
          customerPhone: cust.phone,
          numberOfPeople: isDineIn ? rand(1, 5) : 0,
          createdBy: waiter._id,
          assignedChef: chef._id,
          servedBy: done ? waiter._id : null,
          source: 'staff',
          items,
          status,
          isBilled: done,
          totalAmount: totalAmt,
          taxAmount: tax,
          grandTotal: grand,
          paymentType,
          // Order.paymentStatus enum is ['unpaid','partial','paid'] — 'pending'
          // belongs to paymentApproval.status, a different field entirely.
          paymentStatus: done ? 'paid' : 'unpaid',
          amountPaid: done ? grand : 0,
          completedAt: done ? new Date(when.getTime() + rand(15, 45) * 60000) : null,
          createdAt: when,
          updatedAt: when,
        });

        if (done) {
          const last = orderDocs[orderDocs.length - 1];
          // Revenue is booked GST-exclusive, matching orderFinalizer at runtime.
          txDocs.push({
            locationId: loc._id,
            orderId: last._id,
            type: 'REVENUE',
            source: 'ORDER',
            paymentType,
            title: `Order Payment – ${cust.name}`,
            category: 'Food Sales',
            staffId: waiter._id,
            createdBy: waiter._id,
            totalAmount: totalAmt,
            totalProfit: totalAmt - totalCost,
            status: 'approved',
            approvedBy: adminAt(bId)._id,
            date: when,
            createdAt: when,
            updatedAt: when,
          });
          if (paymentType === 'CASH') {
            const key = `${bId}|${d}`;
            cashByBranchDay.set(key, (cashByBranchDay.get(key) || 0) + grand);
          }
        }
      }
    }
  }
  await Order.insertMany(orderDocs, { timestamps: false });

  // ----------------------------------------------------------------- Expenses
  const expTxDocs = [];
  for (const loc of locations) {
    const ba = adminAt(loc._id.toString());
    for (let d = 0; d < DAYS; d++) {
      const perDay = rand(1, 2);
      for (let n = 0; n < perDay; n++) {
        const when = new Date(now);
        when.setDate(now.getDate() - d);
        when.setHours(rand(10, 18), rand(0, 59), 0, 0);
        const cat = pick(EXPENSE_CATS);
        const amount = cat === 'Rent' ? rand(8000, 15000) : rand(400, 4500);
        expTxDocs.push({
          locationId: loc._id,
          type: 'EXPENSE',
          source: 'MANUAL',
          title: `${cat} Payment`,
          description: `Routine ${cat.toLowerCase()} expense`,
          category: cat,
          totalAmount: amount,
          totalProfit: -amount,
          status: 'approved',
          approvedBy: admin._id,
          createdBy: ba._id,
          date: when,
          createdAt: when,
          updatedAt: when,
        });
      }
    }
  }
  await Transaction.insertMany([...txDocs, ...expTxDocs], { timestamps: false });
  await Expense.insertMany(
    expTxDocs.map((t) => ({
      locationId: t.locationId,
      title: t.title,
      description: t.description,
      amount: t.totalAmount,
      category: t.category,
      status: 'approved',
      type: 'EXPENSE',
      date: t.date,
      // Required by the model — a real expense always carries its receipt, and
      // the Expenses page renders this, so a placeholder keeps the demo honest.
      proofImage: RECEIPT_PLACEHOLDER,
      createdBy: t.createdBy,
      createdAt: t.date,
      updatedAt: t.date,
    })),
    { timestamps: false }
  );

  // --------------------------------------------------------------- Attendance
  const team = [...branchAdmins, ...staff, ...chefs];
  const attendanceDocs = [];
  for (const person of team) {
    for (let d = 0; d < DAYS; d++) {
      const date = new Date(now);
      date.setDate(now.getDate() - d);
      const r = Math.random();
      const status = date.getDay() === 1 ? 'week-off'
        : r < 0.82 ? 'present' : r < 0.9 ? 'half-day' : r < 0.96 ? 'absent' : 'leave';
      attendanceDocs.push({
        user: person._id,
        locationId: person.assignedLocation,
        date: dayStr(date),
        status,
        markedBy: adminAt(idOf(person.assignedLocation))._id,
      });
    }
  }
  await Attendance.insertMany(attendanceDocs, { ordered: false });

  // ------------------------------------------------------------------ Payroll
  const payrollDocs = [];
  for (const person of team) {
    const salary = person.monthlySalary || 25000;
    for (let m = 0; m < 3; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dailyRate = Math.round(salary / 30);
      const payableDays = 30 - (m % 3);
      const baseSalary = dailyRate * payableDays;
      const penalties = { lateMark: (m % 2) * 100, absent: 0, leave: 0 };
      const bonuses = { topSeller: m === 0 && Math.random() < 0.2 ? 1000 : 0, performance: 500, extraShifts: 0 };
      const status = ['PENDING_BRANCH_APPROVAL', 'FINAL_APPROVED', 'PAID'][m];
      const approved = status !== 'PENDING_BRANCH_APPROVAL';
      payrollDocs.push({
        user: person._id,
        month,
        dailyRate,
        payableDays,
        baseSalary,
        penalties,
        bonuses,
        netSalary: baseSalary - penalties.lateMark + bonuses.topSeller + bonuses.performance,
        status,
        approvedByBranchAt: approved ? new Date(d.getFullYear(), d.getMonth(), 28) : undefined,
        approvedByAdminAt: approved ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : undefined,
        approvedBySuperAdminAt: status === 'PAID' ? new Date(d.getFullYear(), d.getMonth() + 1, 2) : undefined,
      });
    }
  }
  await Payroll.insertMany(payrollDocs);

  // ------------------------------------------------------- Cash-drawer shifts
  // Last 10 days closed per branch; today's drawer left OPEN so the widget has
  // a live register. cashSales mirror the seeded CASH orders of that day.
  const cashDocs = [];
  for (const loc of locations) {
    const bId = loc._id.toString();
    const opener = staffAt(bId)[0] || adminAt(bId);
    for (let d = 10; d >= 0; d--) {
      const opened = new Date(now);
      opened.setDate(now.getDate() - d);
      opened.setHours(9, 0, 0, 0);
      if (opened > now) continue;
      const cashSales = cashByBranchDay.get(`${bId}|${d}`) || 0;
      const isToday = d === 0;
      const payOut = isToday ? 0 : rand(0, 600);
      const expected = 2000 + cashSales - payOut;
      const counted = expected + rand(-80, 40);
      const closed = new Date(opened);
      closed.setHours(22, 15, 0, 0);
      cashDocs.push({
        locationId: loc._id,
        status: isToday ? 'open' : 'closed',
        openedBy: opener._id,
        openedAt: opened,
        openingFloat: 2000,
        movements: payOut
          ? [{ type: 'out', amount: payOut, reason: 'Milk & dairy purchase', by: opener._id, at: new Date(opened.getTime() + 4 * 3600000) }]
          : [],
        ...(isToday ? {} : {
          closedBy: adminAt(bId)._id,
          closedAt: closed,
          cashSales,
          countedCash: Math.max(0, counted),
          expectedCash: expected,
          variance: counted - expected,
        }),
        createdAt: opened,
        updatedAt: isToday ? opened : closed,
      });
    }
  }
  await CashSession.insertMany(cashDocs, { timestamps: false });

  // ------------------------------------------------------------- Reservations
  const reservationDocs = [];
  for (const loc of locations) {
    const bId = loc._id.toString();
    const bTables = tablesAt(bId);
    for (let i = 0; i < 6; i++) {
      const offset = rand(-12, 8); // past + upcoming
      const date = new Date(now);
      date.setDate(now.getDate() + offset);
      date.setHours(0, 0, 0, 0);
      const cust = pick(customersAt(bId));
      const past = offset < 0;
      reservationDocs.push({
        eventName: pick(['Birthday Dinner', 'Team Meetup', 'Anniversary', 'Kitty Party', 'Study Group', 'Client Meeting']),
        reservationType: 'table',
        userId: adminAt(bId)._id,
        locationId: loc._id,
        tableIds: [pick(bTables)._id],
        date,
        startTime: pick(['18:00', '19:00', '20:00']),
        endTime: pick(['20:00', '21:00', '22:00']),
        customerName: cust.name,
        customerPhone: cust.phone,
        totalAmount: rand(1500, 6000),
        advancePayment: rand(0, 1000),
        paymentStatus: past ? 'paid' : pick(['pending', 'partial']),
        status: past ? pick(['confirmed', 'confirmed', 'no-show']) : pick(['pending', 'confirmed']),
      });
    }
  }
  await Reservation.insertMany(reservationDocs);

  // ----------------------------------------------------------------- Waitlist
  const waitlistDocs = [];
  for (const loc of locations) {
    const bId = loc._id.toString();
    for (let i = 0; i < 6; i++) {
      const cust = pick(customersAt(bId));
      const isPast = i > 1;
      const created = new Date(now.getTime() - (isPast ? rand(1, 6) * 86400000 : rand(10, 90) * 60000));
      const status = isPast ? pick(['seated', 'seated', 'cancelled', 'no-show']) : 'waiting';
      waitlistDocs.push({
        locationId: loc._id,
        customerName: cust.name,
        customerPhone: cust.phone,
        partySize: rand(1, 6),
        quotedWaitMinutes: rand(5, 30),
        status,
        addedBy: (staffAt(bId)[0] || adminAt(bId))._id,
        tableId: status === 'seated' ? pick(tablesAt(bId))._id : null,
        seatedAt: status === 'seated' ? new Date(created.getTime() + rand(5, 25) * 60000) : undefined,
        createdAt: created,
        updatedAt: created,
      });
    }
  }
  await Waitlist.insertMany(waitlistDocs, { timestamps: false });

  // ----------------------------------------------------------------- Feedback
  const feedbackDocs = [];
  for (const loc of locations) {
    const bId = loc._id.toString();
    for (let i = 0; i < 10; i++) {
      const cust = pick(customersAt(bId));
      const when = new Date(now.getTime() - rand(0, DAYS) * 86400000);
      const rating = pick([5, 5, 5, 4, 4, 4, 3, 3, 2]);
      feedbackDocs.push({
        locationId: loc._id,
        customerName: cust.name,
        customerPhone: cust.phone,
        rating,
        foodRating: Math.min(5, Math.max(1, rating + rand(-1, 1))),
        serviceRating: Math.min(5, Math.max(1, rating + rand(-1, 1))),
        comment: pick(FEEDBACK_COMMENTS),
        source: pick(['qr', 'web', 'staff']),
        createdAt: when,
        updatedAt: when,
      });
    }
  }
  await Feedback.insertMany(feedbackDocs, { timestamps: false });

  // --------------------------------------------------- Gift cards and coupons
  const giftCardDocs = Array.from({ length: 4 }, (_, i) => {
    const initial = pick([500, 1000, 2000]);
    const redeemed = i < 2 ? rand(100, initial / 2) : 0;
    const cust = pick(customers);
    return {
      code: `MLC-GIFT-${1001 + i}`,
      initialBalance: initial,
      balance: initial - redeemed,
      locationId: null, // usable org-wide
      issuedToName: cust.name,
      issuedToPhone: cust.phone,
      issuedBy: admin._id,
      isActive: true,
      expiresAt: new Date(now.getTime() + 180 * 86400000),
      transactions: [
        { type: 'issue', amount: initial, by: admin._id, at: new Date(now.getTime() - rand(5, 20) * 86400000) },
        ...(redeemed ? [{ type: 'redeem', amount: redeemed, by: admin._id, at: new Date(now.getTime() - rand(0, 4) * 86400000) }] : []),
      ],
    };
  });
  await GiftCard.insertMany(giftCardDocs);

  await Coupon.insertMany([
    { code: 'MOON20', discountType: 'percentage', discountValue: 20, maxDiscount: 150, minOrderAmount: 300, expiryDate: new Date(now.getTime() + 45 * 86400000), usageLimit: 200, isActive: true, createdBy: admin._id },
    { code: 'FLAT75', discountType: 'fixed', discountValue: 75, minOrderAmount: 500, expiryDate: new Date(now.getTime() + 30 * 86400000), usageLimit: 100, isActive: true, createdBy: admin._id },
    { code: 'WEEKEND10', discountType: 'percentage', discountValue: 10, maxDiscount: 100, minOrderAmount: 200, expiryDate: new Date(now.getTime() + 60 * 86400000), usageLimit: 500, isActive: true, createdBy: admin._id },
  ]);

  // ------------------------------------------------------------ Notifications
  const notificationDocs = team.map((person) => ({
    sender: superAdmin._id,
    title: 'Welcome to Moon Light Cafe',
    message: 'Your account has been provisioned. Reach out to your branch admin for shift timings.',
    type: 'announcement',
    recipients: [{ user: person._id, isRead: Math.random() < 0.5 }],
  }));
  notificationDocs.push({
    sender: admin._id,
    title: 'Monthly review this Friday',
    message: 'Branch performance review call at 4 PM. Branch admins to share their numbers.',
    type: 'announcement',
    recipients: branchAdmins.map((b) => ({ user: b._id, isRead: false })),
  });
  await Notification.insertMany(notificationDocs);

  // -------------------------------------- Ingredients + per-branch inventory
  const ingredients = await Ingredient.insertMany([
    { name: 'Coffee Beans', unit: 'kg', category: 'General', minThreshold: 5 },
    { name: 'Milk', unit: 'L', category: 'General', minThreshold: 20 },
    { name: 'Sugar', unit: 'kg', category: 'General', minThreshold: 10 },
    { name: 'Flour', unit: 'kg', category: 'General', minThreshold: 15 },
    { name: 'Butter', unit: 'kg', category: 'General', minThreshold: 5 },
    { name: 'Paneer', unit: 'kg', category: 'General', minThreshold: 4 },
  ]);
  const inventoryDocs = [];
  for (const loc of locations) {
    for (const ing of ingredients) {
      inventoryDocs.push({
        branch: loc._id,
        ingredient: ing._id,
        stock: rand(8, 60),
        costPerUnit: rand(40, 220),
        minThreshold: ing.minThreshold,
      });
    }
  }
  await BranchInventory.insertMany(inventoryDocs);

  // -------------------------------------------- Suppliers + purchase orders
  const supplierDocs = await Supplier.insertMany(
    locations.map((loc, i) => ({
      name: ['Fresh Farm Dairy', 'Bean Brothers Roasters', 'Metro Grocery Wholesale'][i] || `Supplier ${i + 1}`,
      phone: String(9600000001 + i),
      email: `supplier${i + 1}@example.com`,
      address: `${loc.city} wholesale market`,
      paymentTerms: pick(['Net 15', 'On delivery']),
      locationId: loc._id,
      isActive: true,
      createdBy: admin._id,
    }))
  );
  const poDocs = [];
  supplierDocs.forEach((sup, i) => {
    const loc = locations[i];
    const received = new Date(now.getTime() - rand(3, 10) * 86400000);
    poDocs.push(
      {
        supplier: sup._id,
        locationId: loc._id,
        status: 'received',
        items: [
          { name: 'Milk', quantity: 40, unitCost: 55 },
          { name: 'Coffee Beans', quantity: 10, unitCost: 480 },
        ],
        createdBy: adminAt(loc._id.toString())._id,
        createdAt: received,
        updatedAt: received,
      },
      {
        supplier: sup._id,
        locationId: loc._id,
        status: 'ordered',
        items: [
          { name: 'Sugar', quantity: 20, unitCost: 42 },
          { name: 'Butter', quantity: 8, unitCost: 380 },
        ],
        createdBy: adminAt(loc._id.toString())._id,
      }
    );
  });
  await PurchaseOrder.insertMany(poDocs, { timestamps: false });

  const summary = {
    customers: customers.length,
    orders: orderDocs.length,
    revenueTransactions: txDocs.length,
    expenses: expTxDocs.length,
    attendance: attendanceDocs.length,
    payroll: payrollDocs.length,
    cashSessions: cashDocs.length,
    reservations: reservationDocs.length,
    waitlist: waitlistDocs.length,
    feedback: feedbackDocs.length,
    giftCards: giftCardDocs.length,
    coupons: 3,
    notifications: notificationDocs.length,
    suppliers: supplierDocs.length,
    purchaseOrders: poDocs.length,
  };
  console.log('[seed] Moon Light history complete:', summary);
  return summary;
};

module.exports = { seedMoonlightHistory, DAYS };
