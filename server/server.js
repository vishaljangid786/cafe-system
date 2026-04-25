require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

// Connect to database
connectDB();

const { initScheduler } = require('./utils/scheduler');
initScheduler();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Initialize Socket.io
const io = require('./config/socket').init(server);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Advanced session management with branch and role scoping
  socket.on('join_session', ({ userId, branchId, role }) => {
    // 1. Personal Room
    if (userId) socket.join(userId);
    
    // 2. Branch Room (Everyone in the branch)
    if (branchId) socket.join(`branch_${branchId}`);
    
    // 3. Role Room (Global role-based)
    if (role) socket.join(`role_${role}`);
    
    // 4. Targeted Intersection (Branch + Role)
    if (branchId && role) {
      socket.join(`branch_${branchId}_${role}`);
    }
    
    console.log(`User ${userId} (${role}) initialized session for branch ${branchId}`);
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
