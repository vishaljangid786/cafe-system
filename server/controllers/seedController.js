const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Location = require('../models/Location');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const Attendance = require('../models/Attendance');
const MenuItem = require('../models/MenuItem');

// Every seeded document is tagged with this marker so seeding stays idempotent
// (we never duplicate) and could be cleaned up later by matching the marker.
const SEED_MARKER = '[seed]';
const SEED_RE = /^\[seed\]/;

// Seeding writes fabricated revenue/attendance, which must NEVER happen against a
// real production database. Allow it only outside production unless explicitly
// overridden with ALLOW_SEED=true (e.g. a throwaway staging box).
const seedingAllowed = () =>
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_SEED === 'true';

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const CATEGORIES = ['Beverages', 'Snacks', 'Main Course', 'Desserts', 'Specials'];
// Weighted so UPI/CASH dominate, mirroring a typical cafe.
const PAYMENT_TYPES = ['UPI', 'UPI', 'UPI', 'CASH', 'CASH', 'CARD', 'OTHER'];

// @desc    Current seed status (counts + whether seeding is enabled)
// @route   GET /api/seed
// @access  Public (read-only)
const seedStatus = asyncHandler(async (req, res) => {
  const [seededTx, totalTx, locations, users] = await Promise.all([
    Transaction.countDocuments({ description: SEED_RE }),
    Transaction.countDocuments(),
    Location.countDocuments(),
    User.countDocuments(),
  ]);
  res.json({
    success: true,
    enabled: seedingAllowed(),
    environment: process.env.NODE_ENV || 'development',
    counts: { seededTransactions: seededTx, totalTransactions: totalTx, locations, users },
  });
});

// @desc    Seed sample dashboard data (transactions, orders, attendance)
// @route   POST /api/seed
// @access  Public — gated to non-production
const seedDatabase = asyncHandler(async (req, res) => {
  if (!seedingAllowed()) {
    res.status(403);
    throw new Error('Seeding is disabled in production. Set ALLOW_SEED=true to override.');
  }

  const force = req.query.force === '1' || req.query.force === 'true' || req.body?.force === true;

  // Idempotency: bail out if we already seeded, unless the caller forces a new batch.
  const alreadySeeded = await Transaction.countDocuments({ description: SEED_RE });
  if (alreadySeeded > 0 && !force) {
    return res.json({
      success: true,
      alreadySeeded: true,
      message: `Sample data already present (${alreadySeeded} seeded transactions). Use "Force re-seed" to add another batch.`,
      created: { transactions: 0, orders: 0, attendance: 0 },
    });
  }

  // Dependencies — we attribute the seeded rows to real Locations/Users.
  const location = await Location.findOne().lean();
  const creator =
    (await User.findOne({ role: { $in: ['super_admin', 'admin'] } }).lean()) ||
    (await User.findOne().lean());

  if (!location || !creator) {
    res.status(400);
    throw new Error('Cannot seed yet: at least one Location and one User must exist first.');
  }

  const staff = await User.find({ role: { $in: ['staff', 'chef', 'branch_admin'] }, deletedAt: null })
    .select('_id name assignedLocation')
    .limit(25)
    .lean();
  const attributable = staff.length ? staff : [creator];
  const menuItems = await MenuItem.find().select('_id name').limit(25).lean();

  const DAYS = 30;
  const txDocs = [];
  const orderDocs = [];
  const attendanceDocs = [];

  for (let d = 0; d < DAYS; d++) {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() - d);
    const dateStr = base.toISOString().split('T')[0];

    // ---- Revenue transactions (drive most dashboard widgets) ----
    const perDay = rand(3, 9);
    for (let n = 0; n < perDay; n++) {
      const when = new Date(base);
      when.setHours(rand(9, 21), rand(0, 59), 0, 0);
      const amount = rand(80, 900);
      const profit = Math.round(amount * (rand(35, 60) / 100));
      const person = pick(attributable);
      const cat = pick(CATEGORIES);
      const mi = menuItems.length ? pick(menuItems) : null;
      txDocs.push({
        locationId: location._id,
        type: 'POS_REVENUE',
        source: 'POS',
        paymentType: pick(PAYMENT_TYPES),
        title: `${SEED_MARKER} ${cat} sale`,
        description: `${SEED_MARKER} sample POS sale`,
        category: cat,
        tableNumber: rand(1, 18),
        staffId: person._id,
        createdBy: creator._id,
        orders: [
          {
            menuItemId: mi ? mi._id : undefined,
            itemName: mi?.name || cat,
            quantity: rand(1, 3),
            price: amount,
            costPrice: amount - profit,
          },
        ],
        totalAmount: amount,
        totalProfit: profit,
        date: when,
        status: 'approved',
        approvedBy: creator._id,
        createdAt: when,
        updatedAt: when,
      });
    }

    // ---- Completed orders (drive the Sales Forecast + order stats) ----
    const ordersPerDay = rand(1, 3);
    for (let o = 0; o < ordersPerDay; o++) {
      const when = new Date(base);
      when.setHours(rand(9, 21), rand(0, 59), 0, 0);
      const amount = rand(120, 700);
      const mi = menuItems.length ? pick(menuItems) : null;
      orderDocs.push({
        branch: location._id,
        orderType: 'takeaway', // avoids the dine-in table requirement
        source: 'staff',
        createdBy: creator._id,
        items: [
          {
            menuItem: mi ? mi._id : new mongoose.Types.ObjectId(),
            itemName: mi?.name || 'Sample Item',
            price: amount,
            quantity: 1,
            status: 'served',
          },
        ],
        status: 'COMPLETED',
        completedAt: when,
        totalAmount: amount,
        paymentType: pick(['CASH', 'UPI', 'CARD']),
        paymentStatus: 'paid',
        amountPaid: amount,
        grandTotal: amount,
        createdAt: when,
        updatedAt: when,
      });
    }

    // ---- Attendance for the last 14 days (drive the Attendance chart) ----
    if (d < 14) {
      attributable.forEach((person) => {
        const r = Math.random();
        const status = r < 0.85 ? 'present' : r < 0.95 ? 'absent' : 'half-day';
        attendanceDocs.push({
          user: person._id,
          locationId: person.assignedLocation || location._id,
          date: dateStr,
          status,
          markedBy: creator._id,
        });
      });
    }
  }

  // timestamps:false so our explicit createdAt/date (spread across the month) are
  // honoured instead of being overwritten with "now".
  const [txResult, orderResult] = await Promise.all([
    Transaction.insertMany(txDocs, { timestamps: false }),
    Order.insertMany(orderDocs, { timestamps: false }),
  ]);

  // Attendance has a unique (user, date) index — on a forced re-seed some rows will
  // collide. ordered:false inserts the rest; we swallow duplicate-key errors.
  let attendanceInserted = 0;
  try {
    const r = await Attendance.insertMany(attendanceDocs, { ordered: false });
    attendanceInserted = r.length;
  } catch (err) {
    attendanceInserted = err?.result?.insertedCount ?? err?.insertedDocs?.length ?? 0;
  }

  res.json({
    success: true,
    message: 'Sample data seeded. Open the dashboard to see it populated.',
    created: {
      transactions: txResult.length,
      orders: orderResult.length,
      attendance: attendanceInserted,
    },
    attributedTo: { location: location.name || location.city || String(location._id), people: attributable.length },
  });
});

// HTML landing page served at "/" with a one-click seed button.
const renderHome = () => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cafe Management API</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background:#0a0a0b; color:#e7e7ea; padding:24px; }
  .card { width:100%; max-width:520px; background:#121214; border:1px solid #26262b; border-radius:20px;
    padding:40px; box-shadow:0 20px 60px rgba(0,0,0,.5); }
  .dot { display:inline-flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:.08em;
    text-transform:uppercase; color:#22c55e; }
  .dot i { width:8px; height:8px; border-radius:99px; background:#22c55e; box-shadow:0 0 0 4px rgba(34,197,94,.15); }
  h1 { font-size:26px; margin:18px 0 6px; letter-spacing:-.02em; }
  p.sub { margin:0 0 28px; color:#9a9aa3; font-size:14px; line-height:1.6; }
  button { width:100%; border:0; border-radius:14px; padding:16px; font-size:13px; font-weight:800;
    letter-spacing:.06em; text-transform:uppercase; cursor:pointer; transition:.15s;
    background:#3b82f6; color:#fff; }
  button:hover { filter:brightness(1.08); }
  button:disabled { opacity:.55; cursor:not-allowed; }
  label.force { display:flex; align-items:center; gap:8px; margin:16px 0 0; font-size:12px; color:#9a9aa3; }
  .out { margin-top:20px; font-size:13px; line-height:1.6; border-radius:12px; padding:14px 16px;
    background:#0e0e10; border:1px solid #26262b; white-space:pre-wrap; word-break:break-word; display:none; }
  .out.show { display:block; }
  .ok { border-color:rgba(34,197,94,.4); }
  .err { border-color:rgba(239,68,68,.4); color:#fca5a5; }
  .muted { color:#6b6b73; font-size:11px; margin-top:18px; text-align:center; letter-spacing:.04em; }
</style>
</head>
<body>
  <div class="card">
    <span class="dot"><i></i> API Running</span>
    <h1>Cafe Management System</h1>
    <p class="sub">Backend is live. Use the button below to populate the database with sample
      sales, orders and attendance so the dashboard has data to display.</p>
    <button id="seedBtn" type="button">Seed Sample Data</button>
    <label class="force"><input type="checkbox" id="force" /> Force re-seed (add another batch)</label>
    <div class="out" id="out"></div>
    <div class="muted">Idempotent &amp; non-destructive — only adds tagged sample rows.</div>
  </div>
<script>
  const btn = document.getElementById('seedBtn');
  const out = document.getElementById('out');
  const force = document.getElementById('force');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Seeding…';
    out.className = 'out show';
    out.textContent = 'Working…';
    try {
      const res = await fetch('/api/seed' + (force.checked ? '?force=1' : ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || ('Request failed (' + res.status + ')'));
      out.className = 'out show ok';
      const c = data.created || {};
      out.textContent = (data.message || 'Done.') +
        '\\n\\nTransactions: ' + (c.transactions ?? 0) +
        '\\nOrders: ' + (c.orders ?? 0) +
        '\\nAttendance: ' + (c.attendance ?? 0);
    } catch (e) {
      out.className = 'out show err';
      out.textContent = e.message || 'Something went wrong.';
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
</script>
</body>
</html>`;

// ── Full demo seed (GET /seed) ───────────────────────────────────────────────
// Browser-visitable reset for the hosted deployment: wipes every collection and
// rebuilds the Moon Light Cafe dataset (seed/moonlightCafe.js — the ONLY
// dataset this project seeds; startupMigrations uses the same one). Because
// that is destructive, a bare GET /seed never seeds — it renders a confirm page
// whose form submits run=1 (so crawlers can't trigger it), and when a SEED_KEY
// env var is configured the run also requires the matching key. No JS on the
// page: helmet's default CSP blocks inline scripts, a plain form needs none.
const {
  seedMoonlightCafe,
  dropAllData,
  PASSWORD: SEED_PASSWORD,
  SUPER_ADMIN_EMAIL,
  CAFE_NAME,
} = require('../seed/moonlightCafe');
const { seedMoonlightHistory, DAYS: HISTORY_DAYS } = require('../seed/moonlightHistory');

const seedShell = (inner) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Seed — Cafe Management API</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background:#0a0a0b; color:#e7e7ea; padding:24px; }
  .card { width:100%; max-width:520px; background:#121214; border:1px solid #26262b; border-radius:20px;
    padding:40px; box-shadow:0 20px 60px rgba(0,0,0,.5); }
  h1 { font-size:24px; margin:0 0 8px; letter-spacing:-.02em; }
  p { color:#9a9aa3; font-size:14px; line-height:1.6; margin:0 0 16px; }
  .warn { border:1px solid rgba(239,68,68,.35); background:rgba(239,68,68,.08); color:#fca5a5;
    border-radius:12px; padding:12px 14px; font-size:13px; line-height:1.55; margin:0 0 20px; }
  .ok { border:1px solid rgba(34,197,94,.4); background:rgba(34,197,94,.08); color:#86efac;
    border-radius:12px; padding:12px 14px; font-size:13px; line-height:1.55; margin:0 0 20px; }
  .counts { display:flex; gap:10px; margin:0 0 20px; flex-wrap:wrap; }
  .counts span { background:#0e0e10; border:1px solid #26262b; border-radius:10px; padding:8px 12px;
    font-size:12px; color:#9a9aa3; }
  .counts b { color:#e7e7ea; }
  input[type=password] { width:100%; background:#0e0e10; border:1px solid #26262b; border-radius:12px;
    padding:13px 14px; color:#e7e7ea; font-size:14px; outline:none; margin:0 0 14px; }
  input[type=password]:focus { border-color:#3b82f6; }
  button { width:100%; border:0; border-radius:14px; padding:16px; font-size:13px; font-weight:800;
    letter-spacing:.06em; text-transform:uppercase; cursor:pointer; transition:.15s;
    background:#3b82f6; color:#fff; }
  button:hover { filter:brightness(1.08); }
  a { color:#3b82f6; text-decoration:none; }
  .muted { color:#6b6b73; font-size:11px; margin-top:18px; text-align:center; letter-spacing:.04em; }
  code { background:#0e0e10; border:1px solid #26262b; border-radius:6px; padding:1px 6px; font-size:12px; }
</style>
</head>
<body><div class="card">${inner}</div></body>
</html>`;

// GET /seed — confirm page with current DB counts and the run form.
const seedPage = asyncHandler(async (req, res) => {
  const [users, locations, transactions] = await Promise.all([
    User.countDocuments(),
    Location.countDocuments(),
    Transaction.countDocuments(),
  ]);
  const needsKey = Boolean(process.env.SEED_KEY);
  res.send(seedShell(`
    <h1>Seed ${CAFE_NAME}</h1>
    <p>Rebuilds the full Moon Light Cafe demo: 1 super admin, 1 cafe + admin, 3 branches with branch admins, staff &amp; chefs, menu, tables, stock — plus ${HISTORY_DAYS} days of sample history for every module: orders, revenue, expenses, attendance, payroll, cash-drawer shifts, customers, reservations, waitlist, feedback, gift cards, coupons, notifications, inventory and purchase orders.</p>
    <div class="counts">
      <span>Users <b>${users}</b></span>
      <span>Branches <b>${locations}</b></span>
      <span>Transactions <b>${transactions}</b></span>
    </div>
    <div class="warn"><b>Warning:</b> this DELETES all existing data in every collection before seeding. It cannot be undone.</div>
    <form method="GET" action="/seed/run">
      <input type="hidden" name="run" value="1" />
      ${needsKey ? '<input type="password" name="key" placeholder="Seed key (SEED_KEY)" required />' : ''}
      <button type="submit">Seed Now — Reset Everything</button>
    </form>
    <div class="muted">${needsKey ? 'Protected by SEED_KEY.' : 'Tip: set a SEED_KEY env var to protect this page.'}</div>
  `));
});

// GET /seed/run — executes the full seed. Needs run=1 (from the form) and the
// SEED_KEY when one is configured.
const runFullSeed = asyncHandler(async (req, res) => {
  if (req.query.run !== '1') return res.redirect('/seed');
  if (process.env.SEED_KEY && req.query.key !== process.env.SEED_KEY) {
    return res.status(403).send(seedShell(`
      <h1>Wrong key</h1>
      <div class="warn">The seed key you entered doesn't match <code>SEED_KEY</code>.</div>
      <p><a href="/seed">&larr; Try again</a></p>
    `));
  }
  await dropAllData();
  const result = await seedMoonlightCafe();
  const history = await seedMoonlightHistory(result);
  res.send(seedShell(`
    <h1>Seeding complete ✓</h1>
    <div class="ok">${CAFE_NAME} rebuilt: ${result.locations.length} branches, ${result.branchAdmins.length} branch admins, ${result.staff.length} staff, ${result.chefs.length} chefs.<br /><br />
    Sample history (${HISTORY_DAYS} days): ${history.orders} orders, ${history.revenueTransactions} revenue entries, ${history.expenses} expenses, ${history.attendance} attendance records, ${history.payroll} payroll rows, ${history.cashSessions} cash-drawer shifts, ${history.customers} customers, ${history.reservations} reservations, ${history.feedback} feedback, ${history.giftCards} gift cards, ${history.notifications} notifications.<br /><br />
    Login: <code>${SUPER_ADMIN_EMAIL.toLowerCase()}</code> / <code>${SEED_PASSWORD}</code><br />
    (every seeded account uses the same password)</div>
    <p><a href="/seed">&larr; Back to seed page</a></p>
  `));
});

module.exports = { seedDatabase, seedStatus, renderHome, seedPage, runFullSeed };
