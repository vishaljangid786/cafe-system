const mongoose = require('mongoose');

let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
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
    return conn.connection;
  } catch (error) {
    connectionPromise = null;
    console.error(`Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
