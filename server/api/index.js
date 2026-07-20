require('dotenv').config();

const { assertRequiredEnv } = require('../config/requiredEnv');
const app = require('../app');
const connectDB = require('../config/db');
const { handleCronDailyReport, handleCronGeneratePayroll } = require('../utils/scheduler');

assertRequiredEnv();

module.exports = async (req, res) => {
  // connectDB() memoizes internally: instant when connected, shares the in-flight
  // promise while connecting, and retries after a failure. Calling it per request
  // (instead of caching the promise here) means one transient connect failure no
  // longer wedges this warm instance into 500ing every request until it recycles.
  await connectDB();

  // Vercel Cron entrypoint (see vercel.json "crons"). Secret-guarded inside the
  // handler. Handled here rather than through the Express app so the cron has a
  // stable, framework-independent endpoint on serverless.
  const path = (req.url || '').split('?')[0];
  if (path === '/api/cron/daily-report') {
    return handleCronDailyReport(req, res);
  }
  if (path === '/api/cron/generate-payroll') {
    return handleCronGeneratePayroll(req, res);
  }

  return app(req, res);
};
