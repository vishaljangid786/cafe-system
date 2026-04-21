const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const checkAPIs = async () => {
  console.log('🧪 Starting API diagnostic sequence...');
  
  const endpoints = [
    { name: 'Auth Check', path: '/auth/profile' },
    { name: 'Locations Matrix', path: '/locations' },
    { name: 'Menu Inventory', path: '/menu' },
    { name: 'Booking Registry', path: '/bookings' },
    { name: 'Coupon Protocols', path: '/coupons' },
  ];

  for (const ep of endpoints) {
    try {
      // Note: This will likely fail with 401 since we don't have a token here,
      // but we want to see if they at least respond (not 404 or 500)
      const res = await axios.get(`${API_URL}${ep.path}`);
      console.log(`✔ ${ep.name}: Operational (${res.status})`);
    } catch (err) {
      if (err.response?.status === 401) {
        console.log(`✔ ${ep.name}: Operational (Requires Auth)`);
      } else {
        console.log(`❌ ${ep.name}: Failure (${err.response?.status || 'No Response'})`);
      }
    }
  }
};

checkAPIs();
