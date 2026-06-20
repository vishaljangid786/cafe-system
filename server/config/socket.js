let io;
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const createNoopIO = () => {
  const noop = {
    to: () => noop,
    emit: () => false,
  };

  return noop;
};

const parseOrigins = (value = '') =>
  value
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const getVercelOrigin = () => {
  if (!process.env.VERCEL_URL) return [];
  const host = process.env.VERCEL_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return [`https://${host}`];
};

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...parseOrigins(process.env.CLIENT_URL),
  ...parseOrigins(process.env.CORS_ORIGIN).filter(origin => origin !== '*'),
  ...getVercelOrigin(),
];

const parseCookies = (header = '') => header.split(';').reduce((acc, part) => {
  const [rawKey, ...rest] = part.trim().split('=');
  if (!rawKey) return acc;
  acc[rawKey] = decodeURIComponent(rest.join('=') || '');
  return acc;
}, {});

module.exports = {
  init: (httpServer) => {
    const { Server } = require('socket.io');
    const { createAdapter } = require('@socket.io/redis-adapter');
    const Redis = require('ioredis');

    io = new Server(httpServer, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      },
    });

    // Redis Adapter for scaling
    if (process.env.REDIS_URL || process.env.NODE_ENV === 'production') {
      const pubClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.io Redis Adapter initialized');
    }

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

        // Mirror HTTP sessionVersion revocation check
        const tokenVersion = decoded.sessionVersion || 1;
        const userVersion = user.sessionVersion || 1;
        if (tokenVersion !== userVersion) {
          return next(new Error('Session revoked. Please log in again.'));
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
      return createNoopIO();
    }
    return io;
  },
};
