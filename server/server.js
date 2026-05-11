require('dotenv').config();
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
const { canAccessLocation, normalizeId } = require('./utils/accessControl');

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
  if (user?.assignedLocation) {
    const branchId = normalizeId(user.assignedLocation);
    socket.join(`branch_${branchId}`);
    socket.join(`branch_${branchId}_${user.role}`);
  }

  // Advanced session management with branch and role scoping
  socket.on('join_session', ({ branchId } = {}) => {
    if (!allow('join_session')) return;
    const targetRole = user.role;
    const isGlobalOrAll = branchId === 'global' || branchId === 'all';
    
    if (branchId && !isGlobalOrAll && canAccessLocation(user, branchId)) {
      socket.join(`branch_${branchId}`);
      socket.join(`branch_${branchId}_${targetRole}`);
    }
  });

  socket.on('join_room', (room) => {
    if (!allow('join_room')) return;
    const branchMatch = typeof room === 'string' && room.match(/^branch_([^_]+)(?:_.+)?$/);
    if (!branchMatch) return;
    const branchId = branchMatch[1];
    if (canAccessLocation(user, branchId)) {
      // Role-Suffix Security Check: Prevent staff from joining _admin or _chef rooms
      const isRoleSpecific = room.includes('_admin') || room.includes('_chef') || room.includes('_staff');
      const roomSuffix = room.split('_').pop();
      
      const isAuthorizedRole = 
        ['super_admin', 'admin'].includes(user.role) || 
        user.role === roomSuffix || 
        !isRoleSpecific;

      if (isAuthorizedRole) {
        socket.join(room);
      } else {
        console.warn(`[SOCKET_AUTH_VIOLATION] User ${user.email} (${user.role}) attempted to join unauthorized room: ${room}`);
      }
    }
  });

  socket.on('disconnect', () => {
    socketCounters.clear(); // Explicitly assist GC
    if (process.env.NODE_ENV === 'development') {
      console.log('Client disconnected:', socket.id);
    }
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
