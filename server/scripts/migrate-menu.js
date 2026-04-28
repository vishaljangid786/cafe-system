const mongoose = require('mongoose');
require('dotenv').config();
const MenuItem = require('../models/MenuItem');
const connectDB = require('../config/db');

const migrateMenu = async () => {
  try {
    await connectDB();
    console.log('Connected to DB for migration...');

    const items = await MenuItem.find({});
    console.log(`Found ${items.length} items to migrate.`);

    for (const item of items) {
      if (!item.availableBranches || item.availableBranches.length === 0) {
        if (item.locationId) {
          item.availableBranches = [item.locationId];
          item.isGlobal = false;
        } else {
          item.isGlobal = true;
          item.availableBranches = [];
        }
        await item.save();
        console.log(`Migrated item: ${item.name}`);
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateMenu();
