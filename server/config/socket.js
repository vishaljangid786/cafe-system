let io;
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const parseCookies = (header = '') => header.split(';').reduce((acc, part) => {
  const [rawKey, ...rest] = part.trim().split('=');
  if (!rawKey) return acc;
  acc[rawKey] = decodeURIComponent(rest.join('=') || '');
  return acc;
}, {});

module.exports = {
  init: (httpServer) => {
    const { Server } = require('socket.io');
    io = new Server(httpServer, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      },
    });

    io.use(async (socket, next) => {
      try {
        const cookies = parseCookies(socket.handshake.headers.cookie || '');
        const token = socket.handshake.auth?.token || cookies.token;
        if (!token) {
          return next(new Error('Socket authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user || user.isBlocked || user.active === false) {
          return next(new Error('Socket authentication failed'));
        }

        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Socket authentication failed'));
      }
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  },
};
