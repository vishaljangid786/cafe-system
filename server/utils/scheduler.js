const cron = require('node-cron');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Location = require('../models/Location');

// Configuration for Mailer
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.mailtrap.io',
  port: process.env.MAIL_PORT || 2525,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const generateDailyReport = async () => {
  console.log('[SCHEDULER] Initiating daily report generation...');
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

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
      // Revenue transactions use status 'approved' (not 'completed') and the `date`
      // field. The old filter matched nothing, so the report always showed ₹0.
      { $match: { type: 'REVENUE', status: 'approved', date: { $gte: startOfDay, $lte: endOfDay } } },
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
    const superAdmins = await User.find({ role: 'super_admin' }).select('email');
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
  cron.schedule('59 23 * * *', () => {
    generateDailyReport();
  });
  console.log('[SCHEDULER] Daily report cron job initialized.');
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

module.exports = { initScheduler, generateDailyReport, handleCronDailyReport };
