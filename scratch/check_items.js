const mongoose = require('mongoose');
require('dotenv').config();
const MenuItem = require('./server/models/MenuItem');

async function checkItems() {
  await mongoose.connect(process.env.MONGO_URI);
  const items = await MenuItem.find({}).select('name locationId').populate('locationId', 'name');
  console.log('--- MENU ITEMS ---');
  items.forEach(i => {
    console.log(`Name: ${i.name}, Location: ${i.locationId ? i.locationId.name : 'GLOBAL'} (${i.locationId ? i.locationId._id : 'null'})`);
  });
  process.exit();
}

checkItems();
