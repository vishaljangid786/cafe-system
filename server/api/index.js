require('dotenv').config();

const app = require('../app');
const connectDB = require('../config/db');
const { handleCronDailyReport } = require('../utils/scheduler');

let dbReady;

module.exports = async (req, res) => {
  dbReady = dbReady || connectDB();
  await dbReady;

  // Vercel Cron entrypoint (see vercel.json "crons"). Secret-guarded inside the
  // handler. Handled here rather than through the Express app so the cron has a
  // stable, framework-independent endpoint on serverless.
  const path = (req.url || '').split('?')[0];
  if (path === '/api/cron/daily-report') {
    return handleCronDailyReport(req, res);
  }

  return app(req, res);
};
