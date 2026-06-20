const bcrypt = require('bcrypt');
const User = require('../models/User');

const QUICK_LOGIN_PASSWORD = '123456';
const RESET_PASSWORDS_MIGRATION_ID = '2026-06-20-reset-all-user-passwords-to-123456';

const resetAllUserPasswordsOnce = async (connection) => {
  const migrations = connection.db.collection('startup_migrations');
  const now = new Date();

  try {
    await migrations.insertOne({
      _id: RESET_PASSWORDS_MIGRATION_ID,
      status: 'running',
      description: 'Reset all user passwords to the testing quick-login password.',
      startedAt: now,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return;
    }
    throw error;
  }

  try {
    const hashedPassword = await bcrypt.hash(QUICK_LOGIN_PASSWORD, 10);
    const result = await User.updateMany(
      {},
      {
        $set: { password: hashedPassword },
        $inc: { sessionVersion: 1 },
      }
    );

    await migrations.updateOne(
      { _id: RESET_PASSWORDS_MIGRATION_ID },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
      }
    );

    console.log(
      `[startup] Reset ${result.modifiedCount} user passwords to the quick-login password.`
    );
  } catch (error) {
    await migrations.updateOne(
      { _id: RESET_PASSWORDS_MIGRATION_ID },
      {
        $set: {
          status: 'failed',
          failedAt: new Date(),
          error: error.message,
        },
      }
    );
    throw error;
  }
};

const runStartupMigrations = async (connection) => {
  await resetAllUserPasswordsOnce(connection);
};

module.exports = {
  QUICK_LOGIN_PASSWORD,
  runStartupMigrations,
};
