const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all customers with pagination & search
// @route   GET /api/customers
// @access  Private/Admin
const getCustomers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '', sort = '-totalSpend' } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const total = await Customer.countDocuments(query);
  const customers = await Customer.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .lean();

  res.json({
    success: true,
    count: customers.length,
    total,
    pages: Math.ceil(total / limitNum),
    page: pageNum,
    data: customers
  });
});

// @desc    Get top customers by spend
// @route   GET /api/customers/top
// @access  Private/Admin
const getTopCustomers = asyncHandler(async (req, res) => {
  const customers = await Customer.find()
    .sort({ totalSpend: -1 })
    .limit(10)
    .lean();

  res.json({ success: true, data: customers });
});

// @desc    Get inactive customers (No visits in last 30 days)
// @route   GET /api/customers/inactive
// @access  Private/Admin
const getInactiveCustomers = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const customers = await Customer.find({ lastVisit: { $lt: thirtyDaysAgo } })
    .sort({ lastVisit: -1 })
    .limit(20)
    .lean();

  res.json({ success: true, count: customers.length, data: customers });
});

// @desc    Get CRM KPI Analytics
// @route   GET /api/customers/analytics
// @access  Private/Admin
const getCustomerAnalytics = asyncHandler(async (req, res) => {
  const totalCustomers = await Customer.countDocuments();
  
  const repeatCustomers = await Customer.countDocuments({ visits: { $gt: 1 } });
  
  const repeatRate = totalCustomers > 0 ? ((repeatCustomers / totalCustomers) * 100).toFixed(1) : 0;
  
  const totalLoyaltyPoints = await Customer.aggregate([
    { $group: { _id: null, total: { $sum: '$loyaltyPoints' } } }
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const inactiveCustomersCount = await Customer.countDocuments({ lastVisit: { $lt: thirtyDaysAgo } });

  res.json({
    success: true,
    data: {
      totalCustomers,
      repeatCustomers,
      repeatRate: parseFloat(repeatRate),
      totalLoyaltyPoints: totalLoyaltyPoints.length > 0 ? totalLoyaltyPoints[0].total : 0,
      inactiveCustomersCount
    }
  });
});

module.exports = {
  getCustomers,
  getTopCustomers,
  getInactiveCustomers,
  getCustomerAnalytics
};
