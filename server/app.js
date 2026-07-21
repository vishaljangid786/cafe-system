const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { withRateLimitStore } = require('./utils/rateLimitStore');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const tableRoutes = require('./routes/tableRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const locationRoutes = require('./routes/locationRoutes'); // Renamed
const cafeRoutes = require('./routes/cafeRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const salaryRoutes = require('./routes/salaryRoutes');
const couponRoutes = require('./routes/couponRoutes');
const menuRoutes = require('./routes/menuRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const exportRoutes = require('./routes/exportRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customerRoutes = require('./routes/customerRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const permissionPresetRoutes = require('./routes/permissionPresetRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const cashDrawerRoutes = require('./routes/cashDrawerRoutes');
const leaveRequestRoutes = require('./routes/leaveRequestRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const giftCardRoutes = require('./routes/giftCardRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');
const publicRoutes = require('./routes/publicRoutes');
const seedRoutes = require('./routes/seedRoutes');
const cookieParser = require('cookie-parser');
const app = express();

// Behind a proxy (Vercel / host load balancer) — required so express-rate-limit
// and req.ip use the real client IP instead of the proxy's egress IP (otherwise
// the login throttle keys off one shared IP and is trivially defeated).
app.set('trust proxy', 1);

const parseOrigins = (value = '') =>
  value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const getVercelOrigin = () => {
  if (!process.env.VERCEL_URL) return [];
  const host = process.env.VERCEL_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return [`https://${host}`];
};

const configuredCorsOrigins = parseOrigins(process.env.CORS_ORIGIN);
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...parseOrigins(process.env.CLIENT_URL),
  ...configuredCorsOrigins,
  ...getVercelOrigin(),
]);

const allowAnyOrigin = configuredCorsOrigins.includes('*');
if (allowAnyOrigin && process.env.NODE_ENV === 'production') {
  throw new Error('CORS_ORIGIN="*" is not allowed in production when credentials are enabled');
}

const corsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/+$/, '');
    // In production wildcard is blocked above; in dev it is allowed only for non-credentialed testing
    if (!origin || (allowAnyOrigin && process.env.NODE_ENV !== 'production') || allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    // Give CORS rejections a 403 so errorHandler doesn't misread the
    // default res.statusCode (200) as 500.
    const err = new Error(`CORS blocked for origin: ${origin}`);
    err.statusCode = 403;
    return callback(err);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 3. Security & Optimization Middlewares
app.use(helmet());
app.use(mongoSanitize());
app.use(hpp());
app.use(cookieParser());

// CSRF mitigation for cookie auth: a state-changing request that carries the
// auth cookie must come from an allowed origin. Cross-site <form>/<img> attacks
// can't forge the Origin/Referer, and Bearer-token clients (no cookie) are exempt
// since they aren't CSRF-able.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.cookies?.token) return next();
  if (allowAnyOrigin && process.env.NODE_ENV !== 'production') return next();
  const origin = req.headers.origin?.replace(/\/+$/, '');
  let ok = !!origin && allowedOrigins.has(origin);
  if (!ok && !origin && req.headers.referer) {
    try { ok = allowedOrigins.has(new URL(req.headers.referer).origin.replace(/\/+$/, '')); } catch (e) { /* invalid referer */ }
  }
  if (!ok) {
    res.status(403);
    return next(new Error('Cross-site request blocked (CSRF protection)'));
  }
  const csrfCookie = req.cookies.csrfToken;
  const csrfHeader = req.get('x-csrf-token');
  const left = Buffer.from(String(csrfCookie || ''));
  const right = Buffer.from(String(csrfHeader || ''));
  const csrfOk = left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
  if (!csrfOk) {
    res.status(403);
    return next(new Error('Invalid CSRF token'));
  }
  next();
});

// Rate Limiting
const limiter = rateLimit(withRateLimitStore({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
}, 'api'));
app.use('/api/', limiter);

// Specific Rate Limiter for Login
const loginLimiter = rateLimit(withRateLimitStore({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 login attempts per hour
  message: 'Too many login attempts, please try again in an hour.'
}, 'login'));
app.use('/api/auth/login', loginLimiter);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.get('/healthz', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.get('/readyz', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    mongo: ready ? 'connected' : 'not_connected',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/cafes', cafeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/permission-presets', permissionPresetRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cash-drawer', cashDrawerRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/gift-cards', giftCardRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/seed', seedRoutes);

// Browser-visitable full demo seed: GET /seed shows a confirm page, its form
// hits /seed/run which wipes and rebuilds the demo dataset (seed/data.js).
// Guarded by the run=1 form flag + optional SEED_KEY env var.
const { seedPage, runFullSeed } = require('./controllers/seedController');
app.get('/seed', seedPage);
app.get('/seed/run', runFullSeed);

app.get('/', (req, res) => {
  res.json({ success: true, service: 'CafeOS API', health: '/healthz', readiness: '/readyz' });
});

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

module.exports = app;
