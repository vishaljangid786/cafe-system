/*
 * Minimal smoke test (no framework) — a CI gate that catches load-time breakage
 * (syntax errors, bad requires, broken exports) across the whole server graph
 * without needing a database connection. Run with: `npm test`.
 *
 * This is a starting point, NOT a substitute for real regression tests of the
 * order/ledger/inventory flows — add those with a runner like Jest/Vitest over time.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Provide a dev fallback so module-load doesn't warn/exit on the fail-closed
// ENCRYPTION_KEY check during the smoke run (never used for real data here).
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'smoke-test-key-not-for-real-data';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-test-jwt-secret';

let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (err) { failures++; console.error(`  FAIL ${name}: ${err.message}`); }
};

// 1) The Express app builds and is a request handler.
check('app builds and exports a handler', () => {
  const app = require('../app');
  assert.strictEqual(typeof app, 'function', 'app should be an express handler');
});

// 2) Every controller/service/model/middleware/route/util module loads cleanly.
const dirs = ['controllers', 'services', 'models', 'middlewares', 'routes', 'utils', 'validators', 'config'];
for (const dir of dirs) {
  const abs = path.join(__dirname, '..', dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of fs.readdirSync(abs)) {
    if (!file.endsWith('.js')) continue;
    check(`${dir}/${file} loads`, () => { require(path.join(abs, file)); });
  }
}

// 3) A couple of invariants on critical exports.
check('orderFinalizer exports finalizeOrder', () => {
  assert.strictEqual(typeof require('../utils/orderFinalizer').finalizeOrder, 'function');
});
check('sendNotification is callable', () => {
  assert.strictEqual(typeof require('../utils/sendNotification'), 'function');
});

console.log(`\nSmoke test: ${failures === 0 ? 'PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
