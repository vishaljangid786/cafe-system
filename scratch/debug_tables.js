const mongoose = require('mongoose');
const Table = require('./server/models/Table');
const Order = require('./server/models/Order');
const User = require('./server/models/User');
const Location = require('./server/models/Location');
const { getTables } = require('./server/controllers/tableController');

async function debug() {
  try {
    console.log('Starting debug...');
    // We don't actually need to connect to DB to check for syntax/import errors
    // but let's see if we can at least load the modules
    console.log('Modules loaded successfully');
    
    const mockReq = {
      query: {},
      user: {
        role: 'admin',
        accessibleLocations: []
      }
    };
    const mockRes = {
      status: (s) => { console.log('Status set to:', s); return mockRes; },
      json: (d) => { console.log('JSON response sent'); return mockRes; }
    };
    
    // This will likely fail because it's an async handler without a next or a proper express environment
    // but it might reveal ReferenceErrors.
    console.log('Testing getTables call...');
    // asyncHandler wraps it, so we need to call it with (req, res, next)
    // Actually, getTables is the wrapped function.
    
    // Let's just check if Order is defined in the controller's scope
    const fs = require('fs');
    const content = fs.readFileSync('./server/controllers/tableController.js', 'utf8');
    if (content.includes('const Order = require(\'../models/Order\');')) {
      console.log('Order model is imported in tableController');
    } else {
      console.log('Order model NOT found in tableController imports');
    }
    
  } catch (err) {
    console.error('Debug failed:', err);
  }
}

debug();
