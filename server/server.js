require('dotenv').config();

const { assertRequiredEnv } = require('./config/requiredEnv');

try {
  assertRequiredEnv();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = require('./app');
const connectDB = require('./config/db');

// Connect to database
connectDB();

const { initScheduler } = require('./utils/scheduler');
initScheduler();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 CafeOS Backend Synchronized`);
  console.log(`📡 Control Center: http://localhost:${PORT}`);
  console.log(`🌐 Server Live: http://127.0.0.1:${PORT}`);
  console.log(`🛠️  Mode: ${process.env.NODE_ENV || 'development'}\n`);
});

// Initialize Socket.io
const io = require('./config/socket').init(server);
const { canAccessLocation, normalizeId, userLocationIds } = require('./utils/accessControl');

// Per-socket rate guard for client-driven events. Prevents an authenticated
// client from spamming join_session / join_room and exhausting CPU even though
// the membership checks themselves are cheap.
const SOCKET_EVENT_LIMIT = 30; // max events per window
const SOCKET_EVENT_WINDOW_MS = 60 * 1000;

io.on('connection', (socket) => {
  const user = socket.user;
  
  // Per-socket rate guard: Scoped to this connection to avoid global memory leak.
  // Counters are automatically garbage collected when this socket disconnects.
  const socketCounters = new Map();
  const allow = (event) => {
    const now = Date.now();
    const entry = socketCounters.get(event);
    if (!entry || now - entry.windowStart > SOCKET_EVENT_WINDOW_MS) {
      socketCounters.set(event, { count: 1, windowStart: now });
      return true;
    }
    entry.count += 1;
    return entry.count <= SOCKET_EVENT_LIMIT;
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('Client connected:', socket.id, user?.email);
  }

  if (user?._id) socket.join(user._id.toString());
  if (user?.role) socket.join(`role_${user.role}`);

  // Track the currently active branch room so we can leave it on switch
  socket.activeBranchIds = new Set();

  userLocationIds(user).forEach((branchId) => {
    socket.join(`branch_${branchId}`);
    socket.join(`branch_${branchId}_${user.role}`);
    socket.activeBranchIds.add(branchId);
  });

  // Advanced session management with branch and role scoping
  socket.on('join_session', ({ branchId } = {}) => {
    if (!allow('join_session')) return;
    const targetRole = user.role;
    const isGlobalOrAll = branchId === 'global' || branchId === 'all';

    // Leave old branch rooms before joining a new one
    if (socket.activeBranchIds?.size) {
      socket.activeBranchIds.forEach((activeBranchId) => {
        if (activeBranchId !== branchId) {
          socket.leave(`branch_${activeBranchId}`);
          socket.leave(`branch_${activeBranchId}_${targetRole}`);
          socket.activeBranchIds.delete(activeBranchId);
        }
      });
    }

    if (isGlobalOrAll) {
      userLocationIds(user).forEach((allowedBranchId) => {
        socket.join(`branch_${allowedBranchId}`);
        socket.join(`branch_${allowedBranchId}_${targetRole}`);
        socket.activeBranchIds.add(allowedBranchId);
      });
    } else if (branchId && canAccessLocation(user, branchId)) {
      const normalizedBranchId = normalizeId(branchId);
      socket.join(`branch_${normalizedBranchId}`);
      socket.join(`branch_${normalizedBranchId}_${targetRole}`);
      socket.activeBranchIds.add(normalizedBranchId);
    }
  });

  socket.on('join_room', (room) => {
    if (!allow('join_room')) return;
    if (typeof room !== 'string') return;

    // Explicit room grammar: either `branch_<branchId>` or
    // `branch_<branchId>_<role>` where <role> is a known role enum value.
    // No substring/suffix heuristics — anything that doesn't match is rejected.
    const KNOWN_ROLES = ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'];
    const roleAlt = KNOWN_ROLES.join('|');
    const branchMatch = room.match(new RegExp(`^branch_([0-9a-fA-F]{24})(?:_(${roleAlt}))?$`));
    if (!branchMatch) {
      console.warn(`[SOCKET_AUTH_VIOLATION] User ${user.email} (${user.role}) attempted to join malformed room: ${room}`);
      return;
    }

    const branchId = branchMatch[1];
    const roomRole = branchMatch[2]; // undefined for the branch-wide room
    if (!canAccessLocation(user, branchId)) return;

    // Role-scoped room: only super_admin/admin (cross-role visibility) or a user
    // whose own role exactly equals the room's role may join.
    if (roomRole) {
      const allowed = ['super_admin', 'admin'].includes(user.role) || user.role === roomRole;
      if (!allowed) {
        console.warn(`[SOCKET_AUTH_VIOLATION] User ${user.email} (${user.role}) attempted to join unauthorized room: ${room}`);
        return;
      }
    }

    socket.join(room);
  });

  socket.on('disconnect', () => {
    socketCounters.clear(); // Explicitly assist GC
    if (process.env.NODE_ENV === 'development') {
      console.log('Client disconnected:', socket.id);
    }
  });
});

// Handle unhandled promise rejections.
// Do NOT tear down the whole server on a single stray rejection — one rejected
// promise (e.g. a background email/report failure) must not take the entire API
// offline. Log/alert and keep serving; let a process supervisor restart on a
// genuine fatal (uncaughtException) instead.
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err && err.stack ? err.stack : err);
});
