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
  console.log(`🌐 Global Access: http://127.0.0.1:${PORT}`);
  console.log(`🛠️  Mode: ${process.env.NODE_ENV || 'development'}\n`);
});

// Initialize Socket.io
const io = require('./config/socket').init(server);
const { canAccessLocation, normalizeId } = require('./utils/accessControl');

io.on('connection', (socket) => {
  const user = socket.user;
  console.log('Client connected:', socket.id, user?.email);

  if (user?._id) socket.join(user._id.toString());
  if (user?.role) socket.join(`role_${user.role}`);
  if (user?.assignedLocation) {
    const branchId = normalizeId(user.assignedLocation);
    socket.join(`branch_${branchId}`);
    socket.join(`branch_${branchId}_${user.role}`);
  }

  // Advanced session management with branch and role scoping
  socket.on('join_session', ({ branchId } = {}) => {
    if (branchId && branchId !== 'global' && branchId !== 'all' && canAccessLocation(user, branchId)) {
      socket.join(`branch_${branchId}`);
      socket.join(`branch_${branchId}_${user.role}`);
    }

    console.log(`User ${user._id} (${user.role}) initialized session for branch ${branchId || normalizeId(user.assignedLocation) || 'global'}`);
  });

  socket.on('join_room', (room) => {
    const branchMatch = typeof room === 'string' && room.match(/^branch_([^_]+)(?:_.+)?$/);
    if (!branchMatch) return;
    const branchId = branchMatch[1];
    if (canAccessLocation(user, branchId)) {
      socket.join(room);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
