const cron = require('node-cron');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Location = require('../models/Location');
const { runMonthlyPayrollGeneration } = require('../controllers/salaryController');

// Configuration for Mailer
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.mailtrap.io',
  port: process.env.MAIL_PORT || 2525,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Asia/Kolkata is a fixed +05:30 offset (no DST). Compute the UTC instants that
// bound the current IST calendar day, so the daily window is the Indian business
// day regardless of the server/runtime timezone (UTC on Vercel).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istDayWindow = (at = new Date()) => {
  const ist = new Date(at.getTime() + IST_OFFSET_MS); // shift into IST wall-clock
  const istMidnightTs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const startOfDay = new Date(istMidnightTs - IST_OFFSET_MS); // real UTC instant of IST 00:00
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startOfDay, endOfDay };
};

const generateDailyReport = async () => {
  console.log('[SCHEDULER] Initiating daily report generation...');

  const { startOfDay, endOfDay } = istDayWindow();

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Daily Operational Summary');

    // Headers
    sheet.columns = [
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    // Data Aggregation
    const totalExpenses = await Expense.aggregate([
      { $match: { date: { $gte: startOfDay, $lte: endOfDay } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRevenue = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: startOfDay, $lte: endOfDay },
          status: 'approved',
          type: { $in: ['REVENUE', 'POS_REVENUE', 'MANUAL_REVENUE'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const bookingsCount = await Booking.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    sheet.addRows([
      { category: 'Financials', metric: 'Total Revenue', value: `₹${totalRevenue[0]?.total || 0}` },
      { category: 'Financials', metric: 'Total Expenses', value: `₹${totalExpenses[0]?.total || 0}` },
      { category: 'Operations', metric: 'New Bookings', value: bookingsCount },
      { category: 'Staff', metric: 'System Active Since', value: new Date().toLocaleTimeString() }
    ]);

    // Styling
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FFF59E0B'} }; // Amber

    const buffer = await workbook.xlsx.writeBuffer();

    // Send Email to Super Admins
    const superAdmins = await User.find({ role: 'super_admin', deletedAt: null }).select('email');
    const recipientEmails = superAdmins.map(u => u.email).join(', ');

    if (!recipientEmails) {
      console.warn('[SCHEDULER] No Super Admin emails found for reporting.');
      return;
    }

    const mailOptions = {
      from: `"Cafe Daily Report" <${process.env.MAIL_FROM || 'scheduler@cafematrix.io'}>`,
      to: recipientEmails,
      subject: `Enterprise Daily Report - ${new Date().toLocaleDateString()}`,
      text: `Please find attached the daily operational report for ${new Date().toDateString()}.`,
      attachments: [
        {
          filename: `Daily_Report_${new Date().getTime()}.xlsx`,
          content: buffer,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log('[SCHEDULER] Daily report dispatched successfully.');
  } catch (error) {
    console.error('[SCHEDULER] Report Generation Error:', error);
  }
};

// The just-ended calendar month as YYYY-MM. Payroll runs on the 1st for the month
// that just closed, so all of its attendance is final.
const previousMonthString = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Auto-generate PENDING_APPROVAL payrolls for every staff/chef for the month that
// just ended, then notify admins/branch-admins (handled inside the controller).
const generateMonthlyPayroll = async () => {
  const month = previousMonthString();
  console.log(`[SCHEDULER] Generating month-end payroll for ${month}...`);
  try {
    const count = await runMonthlyPayrollGeneration(month);
    console.log(`[SCHEDULER] Month-end payroll generated: ${count} record(s) for ${month}.`);
  } catch (error) {
    console.error('[SCHEDULER] Month-end payroll generation failed:', error);
  }
};

// Schedule for 11:59 PM every day.
// node-cron relies on a long-lived process, which does NOT exist on serverless
// (Vercel) — the function is torn down after each request, so the timer never
// fires. On serverless we skip the in-process cron entirely and rely on a Vercel
// Cron hitting the secret-guarded /api/cron/daily-report route (see vercel.json).
const isServerless = () => process.env.VERCEL === '1' || !!process.env.VERCEL;

const initScheduler = () => {
  if (isServerless()) {
    console.log('[SCHEDULER] Serverless runtime detected — skipping in-process cron. Use Vercel Cron -> /api/cron/daily-report.');
    return;
  }
  // 23:59 IST daily. The timezone option pins the schedule to IST regardless of
  // the host's local timezone.
  cron.schedule('59 23 * * *', () => {
    generateDailyReport();
  }, { timezone: 'Asia/Kolkata' });
  // 00:30 IST on the 1st of every month — generate the previous month's payroll.
  cron.schedule('30 0 1 * *', () => {
    generateMonthlyPayroll();
  }, { timezone: 'Asia/Kolkata' });
  console.log('[SCHEDULER] Daily report + monthly payroll cron jobs initialized.');
};

// Secret-guarded HTTP trigger for serverless cron. Vercel Cron invocations carry
// the project's CRON_SECRET as `Authorization: Bearer <secret>`. We require it so
// the daily-report endpoint can't be triggered by arbitrary clients.
const handleCronDailyReport = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers?.authorization || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!secret || provided !== secret) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    await generateDailyReport();
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[SCHEDULER] Cron daily report failed:', err);
    res.status(500).json({ success: false });
  }
};

// Secret-guarded HTTP trigger for serverless month-end payroll. Vercel Cron (or a
// manual call) hits this with the project's CRON_SECRET. Accepts an optional
// ?month=YYYY-MM override; otherwise generates the previous month.
const handleCronGeneratePayroll = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers?.authorization || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!secret || provided !== secret) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    const q = req.query?.month;
    const month = (typeof q === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(q)) ? q : previousMonthString();
    const count = await runMonthlyPayrollGeneration(month);
    res.status(200).json({ success: true, month, count });
  } catch (err) {
    console.error('[SCHEDULER] Cron payroll generation failed:', err);
    res.status(500).json({ success: false });
  }
};

module.exports = { initScheduler, generateDailyReport, handleCronDailyReport, generateMonthlyPayroll, handleCronGeneratePayroll };
