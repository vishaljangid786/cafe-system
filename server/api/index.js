require('dotenv').config();

const app = require('../app');
const connectDB = require('../config/db');

let dbReady;

module.exports = async (req, res) => {
  dbReady = dbReady || connectDB();
  await dbReady;

  return app(req, res);
};
