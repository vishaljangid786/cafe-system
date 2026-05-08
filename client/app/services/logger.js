// Lightweight client logger. No-ops in production so error bodies and stack
// traces don't pollute end-user consoles or accidentally leak data into
// browser dev tools that customers might open. In development it forwards to
// console so DX is unchanged.
//
// Usage: import logger from '@/services/logger';
//        logger.error('fetch failed', err);

const isProd = process.env.NODE_ENV === 'production';

const logger = {
  error: (...args) => {
    if (!isProd && typeof console !== 'undefined') {
      console.error(...args);
    }
  },
  warn: (...args) => {
    if (!isProd && typeof console !== 'undefined') {
      console.warn(...args);
    }
  },
  info: (...args) => {
    if (!isProd && typeof console !== 'undefined') {
      console.info(...args);
    }
  },
};

export default logger;
