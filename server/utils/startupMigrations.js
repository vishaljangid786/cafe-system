// Startup migrations run once when the database connection is established.
//
// NOTE: a previous migration here reset EVERY user's password to a hardcoded
// testing value ("123456") on startup. That was destructive — it silently
// wiped real user passwords on each fresh deploy / fresh database — and has
// been removed. Add only real, idempotent, non-destructive migrations here.
const runStartupMigrations = async (connection) => {
  // Intentionally a no-op.
};

module.exports = { runStartupMigrations };
