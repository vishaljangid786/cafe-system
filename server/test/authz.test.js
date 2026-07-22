// Guard rails for the access-control surface.
//
// These are STATIC tests: they read the route and controller sources rather than
// booting the app, because the property we care about is structural — "no route
// reaches a handler without a gate", "no handler acts on a branch record without
// checking the branch". A runtime test can only prove it for the paths it
// happens to exercise; this proves it for all of them, including the route
// somebody adds next month.
//
// Run: npm run test:authz
//
// When one of these fails, the fix is almost never to widen the allowlist — it
// is to add the missing gate. Only add to an allowlist when the route is
// genuinely public (a customer scanning a QR has no account) and say why.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '..');
const ROUTES_DIR = path.join(SERVER, 'routes');
const CONTROLLERS_DIR = path.join(SERVER, 'controllers');

const GATES = [
  'checkRoles', 'checkPermissions', 'checkAction',
  'checkRoleOrPermission', 'checkAnyPermission', 'canImpersonate',
  'gateCanCreateUser',
];
const MUTATING = ['post', 'put', 'patch', 'delete'];

// Route files that serve unauthenticated callers BY DESIGN.
//   publicRoutes — the customer QR ordering surface; customers have no account.
//   authRoutes   — login / register must be reachable while logged out.
const PUBLIC_ROUTE_FILES = new Set(['publicRoutes.js', 'authRoutes.js']);

// Individual endpoints that are deliberately open. Each needs a reason.
const PUBLIC_ENDPOINTS = new Set([
  'bookingRoutes.js:check-availability',  // public booking page checks free slots
  'bookingRoutes.js:createBooking',       // a guest books without an account
  'feedbackRoutes.js:submitFeedback',     // QR feedback form, no login
  'locationRoutes.js:public',             // branch list for the public booking page
  // Meta calls the WhatsApp webhook unauthenticated: GET is the subscription
  // handshake (verify_token), POST is verified by the X-Hub-Signature-256 HMAC.
  'whatsappRoutes.js:webhook',
  // The scheduled-automations runner is guarded INSIDE the controller — a cron
  // sends CRON_SECRET, otherwise it requires a super_admin session (optionalVerifyToken).
  'whatsappRoutes.js:automations/run',
]);

// Endpoints that act only on the CALLER'S OWN data, so a permission gate would
// be meaningless — the controller scopes by req.user._id.
const SELF_SERVICE = new Set([
  'attendanceRoutes.js:checkIn',
  'attendanceRoutes.js:checkOut',
  'leaveRequestRoutes.js:createLeaveRequest',
  'leaveRequestRoutes.js:cancelLeaveRequest',
  'notificationRoutes.js:createNotification',   // hierarchy enforced in controller
  'notificationRoutes.js:markAllAsRead',
  'notificationRoutes.js:markAsRead',
  'notificationRoutes.js:markAsUnread',
  'userRoutes.js:updateProfile',
  'userRoutes.js:changePassword',
]);

const readDir = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

// ---------------------------------------------------------------------------

test('every route is authenticated unless explicitly public', () => {
  const offenders = [];

  for (const file of readDir(ROUTES_DIR)) {
    if (PUBLIC_ROUTE_FILES.has(file)) continue;
    const lines = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8').split('\n');
    const blanketAuth = lines.findIndex((l) => /router\.use\(\s*verifyToken/.test(l));

    lines.forEach((line, i) => {
      const m = line.match(/router\.(get|post|put|patch|delete)\(/) || line.match(/^\s*\.(get|post|put|patch|delete)\(/);
      if (!m) return;
      // A route declaration often spans several lines, with verifyToken on one of
      // them (see exportRoutes). Judge the whole statement, not the first line.
      const stmt = lines.slice(i, Math.min(i + 8, lines.length)).join(' ');
      const authed = blanketAuth !== -1 ? i > blanketAuth : /verifyToken/.test(stmt);
      if (authed) return;
      // Allow a named exception.
      const exempt = [...PUBLIC_ENDPOINTS].some((k) => {
        const [f, needle] = k.split(':');
        return f === file && stmt.includes(needle);
      });
      if (!exempt) offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 80)}`);
    });
  }

  assert.deepEqual(offenders, [], `Unauthenticated route(s):\n${offenders.join('\n')}`);
});

test('every mutating route carries a permission gate', () => {
  const offenders = [];

  for (const file of readDir(ROUTES_DIR)) {
    if (PUBLIC_ROUTE_FILES.has(file)) continue;
    const lines = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8').split('\n');
    const blanketGate = lines.findIndex((l) => /router\.use\(/.test(l) && GATES.some((g) => l.includes(g)));

    lines.forEach((line, i) => {
      const m = line.match(/router\.(post|put|patch|delete)\(/) || line.match(/^\s*\.(post|put|patch|delete)\(/);
      if (!m) return;
      if (!MUTATING.includes(m[1])) return;

      // A router.route(...) chain can wrap; look ahead for the gate.
      const stmt = lines.slice(i, Math.min(i + 6, lines.length)).join(' ');
      const gated = GATES.some((g) => stmt.includes(g)) || (blanketGate !== -1 && i > blanketGate);
      if (gated) return;

      const exempt = [...SELF_SERVICE, ...PUBLIC_ENDPOINTS].some((k) => {
        const [f, needle] = k.split(':');
        return f === file && stmt.includes(needle);
      });
      if (!exempt) offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 80)}`);
    });
  }

  assert.deepEqual(offenders, [], `Ungated mutating route(s):\n${offenders.join('\n')}`);
});

// ---------------------------------------------------------------------------

test('handlers that load a record by id check its scope', () => {
  // Anything proving the handler considered ownership/tenant/branch.
  const SCOPE_CHECKS = [
    'enforceLocationAccess', 'canAccessLocation', 'assertCanDelete', 'scopedLocationId',
    'scopedLocationIds', 'userLocationIds', 'buildBranchFilter', 'allowedLocationFilter',
    'assertBranchesUnderOneAdmin', 'loadDeletableUser', 'canAccessCafe', 'resolveUserCafeIds',
    'userCafeIds', 'assertCouponScope', 'ensureCanManageUserRank', 'ensureCanManageUserLocation',
    'req.user._id.toString()', 'req.user._id.equals', 'String(req.user._id)',
    'user: req.user._id', 'createdBy: req.user._id', 'openedBy: req.user._id',
  ];
  const BY_ID = /\b(findById|findOne|findByIdAndUpdate|findByIdAndDelete|findOneAndUpdate|findOneAndDelete)\b/;

  // Handlers whose route is already restricted to super_admin, or that operate on
  // org-level records with no branch of their own.
  const ALLOWED = new Set([
    'cafeController.js:getCafeImpact',        // super_admin route
    'cafeController.js:setCafeSuspension',    // super_admin route
    'cafeController.js:addCafeAdmin',         // super_admin route
    'cafeController.js:removeCafeAdmin',      // super_admin route
    'categoryController.js:updateCategory',   // categories are global; super_admin/admin route
    'categoryController.js:deleteCategory',
    'recipeController.js:getRecipe',          // recipes are global; super_admin/admin route
    'recipeController.js:deleteRecipe',
    'permissionPresetController.js:updatePreset',
    'permissionPresetController.js:deletePreset',
    'userController.js:purgeUser',            // super_admin route
    'userController.js:restoreUser',          // super_admin route
  ]);

  const offenders = [];

  for (const file of readDir(CONTROLLERS_DIR)) {
    const lines = fs.readFileSync(path.join(CONTROLLERS_DIR, file), 'utf8').split('\n');

    // A controller often wraps its scope check in a local helper (orderController's
    // ensureOrderAccess is just enforceLocationAccess); treat calls to those as checks.
    const localHelpers = [];
    lines.forEach((l, i) => {
      const m = l.match(/const\s+(\w+)\s*=\s*\(?\s*(?:async\s*)?\(?[^)]*\)?\s*=>/);
      if (!m) return;
      const body = lines.slice(i, i + 14).join('\n');
      if (SCOPE_CHECKS.some((c) => body.includes(c))) localHelpers.push(m[1]);
    });
    const checks = [...SCOPE_CHECKS, ...localHelpers, 'req.omsOrder'];

    const starts = [];
    lines.forEach((l, i) => {
      const m = l.match(/const\s+(\w+)\s*=\s*asyncHandler\(/);
      if (m) starts.push({ name: m[1], line: i });
    });

    starts.forEach((s, idx) => {
      const end = idx + 1 < starts.length ? starts[idx + 1].line : lines.length;
      const body = lines.slice(s.line, end).join('\n');
      if (!/req\.params\.\w+/.test(body) || !BY_ID.test(body)) return;
      if (checks.some((c) => body.includes(c))) return;
      if (/role\s*!==\s*'super_admin'/.test(body)) return;
      if (ALLOWED.has(`${file}:${s.name}`)) return;
      offenders.push(`${file}:${s.line + 1}  ${s.name}`);
    });
  }

  assert.deepEqual(
    offenders, [],
    `Handler(s) acting on a record by id with no scope check — a caller could reach another branch's or cafe's data by guessing an id:\n${offenders.join('\n')}`
  );
});

// ---------------------------------------------------------------------------

test('client and server permission registries stay in sync', () => {
  const parseScopes = (src) => {
    const out = {};
    const positions = [];
    const scopeRe = /scope:\s*'([\w]+)'/g;
    let m;
    while ((m = scopeRe.exec(src))) positions.push({ scope: m[1], at: m.index });

    positions.forEach((p, i) => {
      const end = i + 1 < positions.length ? positions[i + 1].at : src.length;
      const block = src.slice(p.at, end);
      const actionRe = /\{\s*action:\s*'([\w]+)'[^}]*?legacy:\s*\{\s*roles:\s*\[([^\]]*)\],\s*perms:\s*\[([^\]]*)\]/g;
      let a;
      while ((a = actionRe.exec(block))) {
        const clean = (s) => s.split(',').map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean).sort().join('|');
        out[`${p.scope}.${a[1]}`] = `roles[${clean(a[2])}] perms[${clean(a[3])}]`;
      }
    });
    return out;
  };

  const serverSrc = path.join(SERVER, 'utils', 'actionPermissions.js');
  const clientSrc = path.join(SERVER, '..', 'client', 'app', 'config', 'actions.js');
  if (!fs.existsSync(clientSrc)) return; // server checked out on its own

  const server = parseScopes(fs.readFileSync(serverSrc, 'utf8'));
  const client = parseScopes(fs.readFileSync(clientSrc, 'utf8'));

  const onlyServer = Object.keys(server).filter((k) => !(k in client));
  const onlyClient = Object.keys(client).filter((k) => !(k in server));
  const mismatched = Object.keys(server).filter((k) => k in client && server[k] !== client[k]);

  assert.deepEqual(onlyServer, [], `Action(s) the server enforces but no UI can reach: ${onlyServer.join(', ')}`);
  assert.deepEqual(onlyClient, [], `Action(s) the UI offers but the server will always reject: ${onlyClient.join(', ')}`);
  assert.deepEqual(
    mismatched.map((k) => `${k}\n   server ${server[k]}\n   client ${client[k]}`), [],
    'Legacy role/permission fallbacks differ — the button would appear for someone the server refuses'
  );
  assert.ok(Object.keys(server).length > 0, 'parsed no action scopes — the parser has drifted from the file format');
});

// ---------------------------------------------------------------------------

test('the password hash is never returned by default', () => {
  const model = fs.readFileSync(path.join(SERVER, 'models', 'User.js'), 'utf8');
  // Wide enough to clear the field's explanatory comment block.
  const passwordBlock = model.slice(model.indexOf('password: {'), model.indexOf('password: {') + 1400);
  assert.match(
    passwordBlock, /select:\s*false/,
    'User.password must be select:false — dozens of handlers load users with no projection and return the document straight to the client'
  );

  // Only the two places that genuinely compare a password may opt back in.
  const optIns = [];
  for (const dir of ['controllers', 'services', 'utils']) {
    const d = path.join(SERVER, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of readDir(d)) {
      const src = fs.readFileSync(path.join(d, f), 'utf8');
      src.split('\n').forEach((l, i) => {
        // Only real opt-ins — a comment explaining the field is not a leak.
        if (l.trim().startsWith('//')) return;
        if (/\.select\(\s*['"`]\+password/.test(l)) optIns.push(`${dir}/${f}:${i + 1}`);
      });
    }
  }
  assert.ok(
    optIns.length <= 2,
    `More places request the password hash than expected (login + change-password). Each one is a chance to leak it:\n${optIns.join('\n')}`
  );
});

// ---------------------------------------------------------------------------

test('the destructive seed endpoint fails closed in production', () => {
  const src = fs.readFileSync(path.join(SERVER, 'controllers', 'seedController.js'), 'utf8');
  const runBlock = src.slice(src.indexOf('const runFullSeed'), src.indexOf('const runFullSeed') + 1200);
  assert.match(
    runBlock, /NODE_ENV === 'production'[\s\S]*?SEED_KEY/,
    'GET /seed/run drops every collection — in production it must refuse unless SEED_KEY is configured'
  );
});

// ---------------------------------------------------------------------------

test('audit log rows can never be deleted by a cascade', () => {
  const graph = fs.readFileSync(path.join(SERVER, 'services', 'dependencyGraph.js'), 'utf8');
  const auditEntries = graph.split('key:').filter((b) => b.trimStart().startsWith("'auditLogs'"));
  assert.ok(auditEntries.length > 0, 'expected auditLogs entries in the dependency graph');
  auditEntries.forEach((block) => {
    assert.match(
      block.slice(0, 300), /purgeable:\s*false/,
      'audit log entries must be purgeable:false — the record of who deleted what has to outlive the deletion'
    );
  });
});
