// Optional Sentry error tracking. Fully inert unless SENTRY_DSN is set, so local
// dev and any deploy without the env var behave exactly as before.
//
// Require this module as EARLY as possible in the process entrypoints (before the
// Express app) so Sentry can auto-instrument HTTP. Errors are reported from the
// central error handler (see middlewares/errorMiddleware.js) for 5xx only —
// expected 4xx (validation, permission, not-found) are user errors, not alerts.

const Sentry = require('@sentry/node');

let enabled = false;

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Tracing is opt-in and off by default (0) to keep overhead/cost predictable.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  });
  enabled = true;
  console.log('[sentry] error tracking enabled');
}

const sentryEnabled = () => enabled;

// Report an exception with optional request context. No-op when disabled.
const captureException = (err, context) => {
  if (!enabled) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch (e) { /* never let error reporting throw */ }
};

module.exports = { Sentry, sentryEnabled, captureException };
