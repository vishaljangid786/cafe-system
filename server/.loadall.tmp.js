// Load every server module to catch syntax / reference errors introduced by the
// bulk patches. Run from the server directory.
require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'y'.repeat(64);

const fs = require('fs');
const path = require('path');

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'test' || e.name === 'seed' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
};

const files = walk(process.cwd());
let bad = 0;
for (const f of files) {
  try {
    require(f);
  } catch (e) {
    if (e instanceof SyntaxError || e instanceof ReferenceError) {
      console.log('FAIL', path.relative(process.cwd(), f), '::', e.name, e.message);
      bad++;
    }
  }
}
console.log(bad ? `${bad} failure(s)` : `all ${files.length} modules parse & load clean`);
process.exit(bad ? 1 : 0);
