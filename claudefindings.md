# CafeOS — Claude Audit Findings

**Started:** 2026-05-08
**Auditor:** Claude (Opus 4.7)
**Scope:** Read-only inspection of `server/` and `client/` plus targeted spot-fixes.
**Approach:** Verify every finding with file path + line. Apply only low-risk fixes without explicit approval. Surface the rest as a backlog.

This document is **not** a replacement for the existing `COMPREHENSIVE_AUDIT_REPORT.md` and `VULNERABILITY_AUDIT_REPORT.md` — those track historical remediation. This is the current snapshot of issues that still exist or have been introduced since.

---

## Status legend

- ✅ **Fixed** — applied this session
- 🟡 **Backlog** — verified, fix proposal documented, awaiting approval
- 🔵 **Watching** — cannot reproduce / needs runtime evidence

---

## Wave 0 — Boot/install regressions (already fixed earlier this session)

| # | Severity | File | Issue | Status |
|---|----------|------|-------|--------|
| 0.1 | CRITICAL | `server/node_modules/express/lib/router/` | Partially-committed `node_modules` left express's router subdir missing — server crashed at boot with `Cannot find module './router'`. | ✅ Reinstalled |
| 0.2 | HIGH | `.gitignore` | Repo-root `.gitignore` did not exclude `node_modules/`; 3,509 files of `server/node_modules` were tracked. | ✅ Untracked |
| 0.3 | MEDIUM | `server/.npmrc` | Peer-dep mismatch between `cloudinary@2.x` and `multer-storage-cloudinary@4.0.0` required `--legacy-peer-deps` on every install. | ✅ Pinned via `.npmrc` |

---

## Wave 1 — Verified backend findings (this session)

### CRITICAL

#### 1.1 — `logActivity` referenced but not imported → crashes the order-edit endpoint
- **File:** [server/controllers/orderController.js:420](server/controllers/orderController.js#L420)
- **Code:** `await logActivity(req.user, 'ORDER_UPDATE_ITEMS', ...)`
- **Evidence:** Top-of-file imports do not include `logActivity`. `grep` confirms it's referenced once in this file with no destructure from `auditLogger`.
- **Impact:** Any time staff/admin edits items on an existing order (`PATCH /api/orders/:id/items`), Node throws `ReferenceError: logActivity is not defined`. The `asyncHandler` converts this to a 500 with stack omitted, but the order edit silently fails after the stock adjustment has already mutated `BranchStock`. This produces phantom inventory drift.
- **Fix:** Add `const { logActivity } = require('../utils/auditLogger');` to the imports.
- **Status:** ✅ Fixed.

#### 1.2 — Reservation creation broadcasts to **all sockets globally** (cross-branch PII leak)
- **File:** [server/controllers/reservationController.js:218](server/controllers/reservationController.js#L218)
- **Code:** `io.emit('new_notification', notification);`
- **Evidence:** `getIO().emit(...)` with no room scoping. Sockets are now authenticated (per `server/config/socket.js`), but `io.emit` still fans out to every connected client.
- **Impact:** Reservation message contains `${eventName} (${reservationType}) by ${customerName} at ${startTime}` — guest name + event + branch — and is delivered to chefs/staff/admins of unrelated branches.
- **Fix:** Scope to the branch + admin role rooms: `io.to(\`branch_${locationId}\`).to('role_admin').to('role_super_admin').emit('new_notification', notification);`
- **Status:** ✅ Fixed.

### HIGH

#### 1.3 — `getCoupons` pagination not clamped (DoS vector)
- **File:** [server/controllers/couponController.js:19](server/controllers/couponController.js#L19)
- **Code:** `const limit = parseInt(req.query.limit, 10) || 20;`
- **Impact:** Authenticated admin can request `?limit=999999` and load every coupon (with `populate('createdBy')`) into memory. The `clampLimit` helper exists in `utils/accessControl.js` precisely for this; it isn't imported here.
- **Fix:** Import `clampLimit` and replace.
- **Status:** ✅ Fixed.

#### 1.4 — `getMenuItems` pagination not clamped (DoS vector)
- **File:** [server/controllers/menuItemController.js:38](server/controllers/menuItemController.js#L38)
- **Code:** `const limit = parseInt(req.query.limit, 10) || 20;`
- **Impact:** Same shape as 1.3 but on the menu listing, which already does `.populate('category')`. Heavy.
- **Fix:** Import `clampLimit` and replace.
- **Status:** ✅ Fixed.

#### 1.5 — Login emails logged in plaintext on every attempt
- **File:** [server/controllers/authController.js:158-162](server/controllers/authController.js#L158-L162)
- **Code:** `console.log('Login attempt:', email);` and `console.log('User found:', ...)`
- **Impact:** PII (email of every user attempting login, including failed attempts which may include typos of unrelated emails) lands in stdout. If logs are shipped to a third-party ingest pipeline, that's a privacy issue. Also, failed-login email logging is a fingerprint for credential-stuffing attacks.
- **Fix:** Gate behind `NODE_ENV === 'development'` or remove entirely (the `loginLimiter` already covers brute-force visibility).
- **Status:** ✅ Fixed (removed; rate-limiter retains operational visibility).

### MEDIUM

#### 1.6 — Error middleware unconditionally console.errors full error objects
- **File:** [server/middlewares/errorMiddleware.js:8](server/middlewares/errorMiddleware.js#L8)
- **Code:** `console.error('SERVER_ERROR:', err);`
- **Impact:** In production, every operational error (e.g. `User not found`, validation failures) emits a full stack trace to stdout. The response itself correctly omits `stack` (returns `null`), so this is server-side only — but it pollutes logs and complicates real-error filtering.
- **Fix:** Keep error logging in production but emit a structured one-liner (`message`, `statusCode`, `path`) and only emit the full stack in development.
- **Status:** ✅ Fixed.

#### 1.7 — Impersonation route relies on controller-level role gating only
- **File:** [server/routes/authRoutes.js:31](server/routes/authRoutes.js#L31)
- **Code:** `router.post('/impersonate/:userId', verifyToken, impersonateUser);`
- **Impact:** Defense-in-depth gap. The controller does check role internally and rejects `chef`/`staff` (line 181-184 of authController.js), so this is not currently exploitable. But every other sensitive route in the codebase pairs `verifyToken` with `authorizeRoles(...)` at the route layer; this is an outlier and a foot-gun if the controller body is ever refactored.
- **Fix:** Add `authorizeRoles('super_admin', 'admin', 'branch_admin')` as a defense-in-depth layer.
- **Status:** ✅ Fixed.

#### 1.8 — Analytics queries hydrate Mongoose documents unnecessarily
- **File:** `server/controllers/analyticsController.js` and `orderController.js:705`
- **Impact:** `Order.find(query).populate(...).populate(...)` without `.lean()` on read-only analytics paths. On large windows (date range >30d, multi-branch admin) this materially increases memory + GC pressure.
- **Fix proposal:** Add `.lean()` to read-only aggregation pipelines that don't call instance methods on the result. **Risk:** if a downstream consumer relies on virtuals or `.toJSON()` transforms, this can change response shape.
- **Status:** 🟡 Backlog (touches hot paths — wants a deliberate review pass with regression checks).

### LOW

#### 1.9 — Audit-trail console.log for impersonation events
- **File:** [server/controllers/authController.js:213](server/controllers/authController.js#L213) and [243](server/controllers/authController.js#L243)
- **Impact:** Already redundant — `AuditLog.create({...})` is called right next to it. The `console.log` is duplicated work that lands sensitive identifiers in stdout.
- **Fix:** Remove the `console.log` lines (the `AuditLog` collection is the source of truth).
- **Status:** 🟡 Backlog (cosmetic; deliberate "operator visibility" choice in some shops).

#### 1.10 — Dev seed endpoint wipes data
- **File:** [server/routes/seedRoutes.js:59-60](server/routes/seedRoutes.js#L59-L60)
- **Code:** `await Attendance.deleteMany({}); await AuditLog.deleteMany({});`
- **Mitigations in place:** Only mounted under `if (process.env.NODE_ENV === 'development')` in `app.js`, and gated by `authorizeRoles('admin', 'super_admin')`.
- **Risk:** If `NODE_ENV` ever leaks into production (Heroku-style "review apps", QA environments), this becomes a one-call attendance/audit-log wipe.
- **Fix proposal:** Add a second guard (`if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') return 403`) and require an explicit env flag.
- **Status:** 🟡 Backlog.

---

## Wave 2 — Verified frontend findings (this session)

### HIGH (theming / consistency)

#### 2.1 — Hardcoded `text-white` / `bg-white` / `text-black` in production pages
- **Files:**
  - [client/app/bookings/page.js:222, 132, 272, 256](client/app/bookings/page.js)
  - [client/app/signup/page.js:177, 181, 189, 201, 204](client/app/signup/page.js)
  - [client/app/dashboard/super-admin/page.js:254-290, 279, 282](client/app/dashboard/super-admin/page.js)
  - [client/app/components/BottomNav.js:51](client/app/components/BottomNav.js)
- **Impact:** [KNOWLEDGE.md:128](KNOWLEDGE.md#L128) explicitly says "Never use hardcoded colors. Use CSS variables like `var(--color-primary)`." These violate that and create theme glitches in light mode.
- **Status:** 🟡 Backlog. Each fix is small but there are many; needs a deliberate sweep with both themes side-by-side.

#### 2.2 — Recharts tooltip hardcodes dark palette
- **File:** [client/app/dashboard/staff/work-history/page.js:151](client/app/dashboard/staff/work-history/page.js#L151)
- **Code:** `<Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', color: '#fff' }} />`
- **Impact:** Tooltip is white-on-near-black always; in light theme it's an out-of-place dark popover.
- **Fix proposal:** Read theme from `useTheme()` and switch tooltip palette accordingly, or use CSS variables in `contentStyle` (`var(--color-surface)` etc.).
- **Status:** 🟡 Backlog.

### MEDIUM

#### 2.3 — `URL.createObjectURL` without `revokeObjectURL` in signup preview
- **File:** [client/app/signup/page.js:243, 334](client/app/signup/page.js)
- **Code:** `<img src={URL.createObjectURL(profileImage)} />`
- **Impact:** Each render creates a new blob URL that is never revoked → memory leak proportional to user re-edits the form.
- **Fix proposal:** Compute the preview URL inside `useEffect` keyed on the file, and `URL.revokeObjectURL` in the cleanup.
- **Status:** 🟡 Backlog (low practical impact unless a user re-uploads many times in one session).

#### 2.4 — 50+ `console.error` calls in client production code
- **Files:** spread across `app/context/AuthContext.js`, `app/dashboard/admin/tables/page.js`, etc.
- **Impact:** Pollutes browser console in production; some include API error bodies which may carry user data.
- **Fix proposal:** Introduce a tiny `clientLogger` helper that no-ops in `process.env.NODE_ENV === 'production'` (or routes to a Sentry-style sink), and codemod the call sites.
- **Status:** 🟡 Backlog.

### LOW

#### 2.5 — `selection:text-black` in dark surface
- **File:** [client/app/dashboard/super-admin/page.js:56](client/app/dashboard/super-admin/page.js#L56)
- **Impact:** Black-on-blue is legible but suboptimal vs. white-on-blue. Pure polish.
- **Status:** 🟡 Backlog.

#### 2.6 — Global keydown blocks `.`, `-`, `e`/`E` on **every** `<input type="number">`
- **File:** [client/app/context/ThemeContext.js:42-72](client/app/context/ThemeContext.js#L42-L72)
- **Investigation:** Backend `menuItemSchema` validates with `isFloat()` (so decimals are technically allowed), but all seed prices are whole-rupee integers. This appears to be an **intentional INR-only "no paise" rule**, but it's enforced from `ThemeContext` (wrong file), is undocumented, and silently overrides any future field that legitimately needs decimals (e.g., commission %, weight, ratings).
- **Fix proposal:** Move the rule to a per-input policy (e.g., `data-allow-decimals` opt-in attribute) so legitimate decimal fields can opt out, **or** keep current behavior but document it clearly. Don't change without product confirmation — this is a design decision, not a bug.
- **Status:** 🟡 Backlog (needs product input).

#### 2.7 — `lucide-react@1.8.0` resolves to a real package
- **Verification:** Installed package matches the npm-published `lucide-react@1.8.0`. (Package was renumbered when it moved off the `0.x` line — not a supply-chain concern.)
- **Status:** 🔵 Watching (no action).

---

## Wave 3 — Categories not yet investigated this session

These are **explicitly out of scope for this turn**. I have not run a deep pass on them and won't claim "audited" until I do.

- Mongo schema indexes — likely missing on hot fields like `Order.branch`, `Order.status`, `Transaction.locationId`, `Attendance.{user,date}`.
- N+1 query patterns in dashboard analytics (initial sample looked clean but full sweep pending).
- Socket.io rate limiting / abuse paths (sockets are authenticated, but emit volume per connection isn't bounded).
- Per-page bundle size and lazy-loading boundaries (recharts and pdfkit are large; need a `next build` analysis).
- Mobile + tablet responsive QA (requires running the app and visually checking breakpoints).
- Form-level a11y: aria labels, tab order, error association.
- Complete cross-controller IDOR sweep — sample showed `enforceLocationAccess` is consistently used in order/reservation/expense paths, but every controller needs to be checked individually.

---

## Wave 1 fixes — applied this session

All seven changes pass `node --check` and the server still boots cleanly.

| # | Severity | File | Change |
|---|----------|------|--------|
| 1.1 | CRITICAL | `server/controllers/orderController.js` | Added `const { logActivity } = require('../utils/auditLogger')`. |
| 1.2 | CRITICAL | `server/controllers/reservationController.js` | Replaced `io.emit(...)` with `io.to('branch_${locationId}').to('role_admin').to('role_super_admin').emit(...)`. |
| 1.3 | HIGH | `server/controllers/couponController.js` | Imported `clampLimit`, replaced `parseInt(req.query.limit)`. |
| 1.4 | HIGH | `server/controllers/menuItemController.js` | Imported `clampLimit`, replaced `parseInt(req.query.limit)`. |
| 1.5 | MEDIUM | `server/controllers/authController.js` | Removed two `console.log` statements that printed login emails. |
| 1.6 | MEDIUM | `server/middlewares/errorMiddleware.js` | Wrapped console.error: full stack in dev, structured one-liner in prod. |
| 1.7 | MEDIUM | `server/routes/authRoutes.js` | Added `authorizeRoles('super_admin', 'admin', 'branch_admin')` to impersonate route (defense-in-depth). |

**Verification:** `node --check` clean on all seven files; `node server.js` boots without errors (the Mongo URI placeholder is the pre-existing unrelated env issue).

---

## Suggested wave order for next session

The remaining 🟡 Backlog items, grouped by risk vs. value:

**Wave 2 — quick safe wins (~30 min):**
- 1.9 Drop console.log in impersonation paths (AuditLog already covers it).
- 1.10 Add a second env flag (`ALLOW_DESTRUCTIVE_SEED`) before the seed wipe.
- 2.5 `selection:text-black` → `selection:text-white` on super-admin page.

**Wave 3 — theme cleanup (~2h, needs visual review):**
- 2.1 Replace hardcoded `text-white`/`bg-white`/`text-black` with CSS variables in `bookings`, `signup`, `super-admin`, `BottomNav` pages.
- 2.2 Make Recharts tooltip theme-aware in `staff/work-history`.
- 2.3 Revoke object URLs in signup preview.

**Wave 4 — broader code hygiene (needs scope decision):**
- 1.8 `.lean()` on read-only analytics paths (touches hot paths; needs regression validation).
- 2.4 Codemod 50+ client `console.error` calls behind a `clientLogger` helper.
- 2.6 Decide product policy on number-input decimal block (intentional? document or relax).

**Wave 5 — areas not yet audited (each is its own pass):**
- Mongo schema indexes for hot fields.
- N+1 query sweep in dashboard analytics.
- Socket abuse paths and emit volume bounding.
- `next build` bundle analysis (recharts, pdfkit).
- Mobile/tablet responsive QA (requires running the app).
- Form a11y (aria, tab order, error association).
- Full IDOR sweep across every controller.

Pick a wave (or call out a specific subset) and I'll execute. Default safer choice is Wave 2.

