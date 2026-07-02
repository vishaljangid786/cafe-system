const mongoose = require('mongoose');
const { runStartupMigrations } = require('../utils/startupMigrations');

// Mongoose 9 auto-attaches a transaction's session to every query in the same
// async context (transactionAsyncLocalStorage). This code threads `session`
// explicitly into every transactional query, so we don't need that — and it was
// harmful: post-commit side effects (e.g. sending the "new order — approve it"
// notification) ran AFTER session.endSession() and inherited the dead session,
// throwing MongoExpiredSessionError and failing order placement. Turn it off so a
// query only uses a session when one is explicitly passed.
mongoose.set('transactionAsyncLocalStorage', false);

let connectionPromise;
let startupMigrationsPromise;

const runMigrationsOncePerProcess = async (connection) => {
  startupMigrationsPromise = startupMigrationsPromise || runStartupMigrations(connection);
  return startupMigrationsPromise;
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    await runMigrationsOncePerProcess(mongoose.connection);
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  try {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 20,      // Handle concurrent requests without exhausting connections
      minPoolSize: process.env.VERCEL === '1' ? 0 : 5,       // Keep local server warm without forcing serverless pools
      serverSelectionTimeoutMS: 5000,
    });

    const conn = await connectionPromise;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await runMigrationsOncePerProcess(conn.connection);
    return conn.connection;
  } catch (error) {
    connectionPromise = null;
    startupMigrationsPromise = null;
    console.error(`Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
