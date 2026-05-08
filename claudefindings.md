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
- **Files touched:**
  - [server/controllers/orderController.js](server/controllers/orderController.js) — added `.lean()` to `getOrders` (list endpoint, 5-populate chain), `getOrderAnalytics`, `getMyChefStats`, `getMyStaffStats`.
  - [server/controllers/userController.js:91](server/controllers/userController.js#L91) — added `.lean()` to `getUsers` (double-populate listing).
  - [server/controllers/notificationController.js:32](server/controllers/notificationController.js#L32) — added `.lean()` to `getNotifications`.
- **Already-optimized:** `analyticsController.js` (forecasting, advanced analytics), `inventoryController.js` (all reads), `transactionController.js` (`getTransactions`) were already using `.lean()`.
- **Status:** ✅ Fixed (Wave 4). All touched paths only feed `res.json(...)` with no instance-method or `.save()` calls on the results, so `.lean()` is safe.

### LOW

#### 1.9 — Audit-trail console.log for impersonation events
- **File:** [server/controllers/authController.js:213](server/controllers/authController.js#L213) and [243](server/controllers/authController.js#L243)
- **Impact:** Already redundant — `AuditLog.create({...})` is called right next to it. The `console.log` is duplicated work that lands sensitive identifiers in stdout.
- **Fix:** Removed both `console.log` calls. Folded the `viewOnly` mode marker (which was only present in the console line) into the `AuditLog.details` string so impersonation mode is still queryable via the audit log.
- **Status:** ✅ Fixed (Wave 2).

#### 1.10 — Dev seed endpoint wipes data
- **File:** [server/routes/seedRoutes.js](server/routes/seedRoutes.js)
- **Code:** `await Attendance.deleteMany({}); await AuditLog.deleteMany({});`
- **Mitigations in place:** Only mounted under `if (process.env.NODE_ENV === 'development')` in `app.js`, gated by `authorizeRoles('admin', 'super_admin')`, and now requires `ALLOW_DESTRUCTIVE_SEED=true` in `.env`.
- **Fix:** Added an early-return 403 at the top of the route handler if `process.env.ALLOW_DESTRUCTIVE_SEED !== 'true'`. Misconfigured QA / preview environments where `NODE_ENV=development` leaks through can no longer have their attendance and audit history wiped by an authenticated admin without an explicit opt-in flag.
- **Status:** ✅ Fixed (Wave 2).

---

## Wave 2 — Verified frontend findings (this session)

### HIGH (theming / consistency)

#### 2.1 — Hardcoded `text-white` / `bg-white` / `text-black` in production pages
- **Re-audit (Wave 3):** Several "findings" were false positives. The signup left panel (lines 167–209) sits inside an always-dark `bg-zinc-900` cinematic showcase — `text-white` inside it is intentional and correct. The bookings "Check Availability" button uses `bg-zinc-800 text-white` which renders correctly in both themes (zinc-800 is a fixed neutral, not light-mode-only). Skipped these.
- **Real fixes applied:**
  - [client/app/bookings/page.js:132,272](client/app/bookings/page.js) — `bg-white/5 dark:bg-zinc-900/50 backdrop-blur-xl border border-border` → existing `glass-card` utility class (already theme-aware, defined in globals.css).
  - [client/app/dashboard/super-admin/page.js:272](client/app/dashboard/super-admin/page.js#L272) — left-over **amber** shadow `rgba(217,119,6,0.3)` (from the pre-blue migration) → `rgba(var(--color-primary-rgb), 0.3)`.
  - [client/app/dashboard/super-admin/page.js:279](client/app/dashboard/super-admin/page.js#L279) — non-highlight icon container `bg-zinc-800 border border-zinc-700` → `bg-[var(--color-surface-soft)] border border-[var(--color-border)]`. The dark zinc box looked heavy on a light card.
  - [client/app/dashboard/super-admin/page.js:308](client/app/dashboard/super-admin/page.js#L308) — `text-zinc-400 group-hover:text-white` → CSS-variable equivalents. The hover `text-white` was invisible against the white surface in light mode.
  - [client/app/components/BottomNav.js:51](client/app/components/BottomNav.js#L51) — active icon `text-black` → `text-white`. White-on-primary-blue is the universally readable pattern.
- **Status:** ✅ Fixed (Wave 3).

#### 2.2 — Recharts tooltip hardcodes dark palette
- **File:** [client/app/dashboard/staff/work-history/page.js:151](client/app/dashboard/staff/work-history/page.js#L151)
- **Fix:** Replaced the hex literals in `contentStyle` with CSS variables (`var(--color-surface)`, `var(--color-border)`, `var(--color-text-primary)`). Browsers resolve CSS variables in inline styles, so the tooltip now follows the active theme without needing to import `useTheme()`.
- **Status:** ✅ Fixed (Wave 3).

### MEDIUM

#### 2.3 — `URL.createObjectURL` without `revokeObjectURL` in signup preview
- **File:** [client/app/signup/page.js](client/app/signup/page.js) (was lines 243, 334)
- **Fix:** Added two new state slots (`profileImagePreview`, `aadharImagePreview`) and `useEffect`s keyed on each `File`. Each effect creates a blob URL on mount and `URL.revokeObjectURL`s it on cleanup. The JSX now reads from the state instead of re-creating a URL on every render.
- **Status:** ✅ Fixed (Wave 3).

#### 2.4 — 50+ `console.error` calls in client production code
- **New helper:** [client/app/services/logger.js](client/app/services/logger.js) — `logger.{error,warn,info}` that no-ops in production.
- **Codemodded high-traffic sites (the global ones every authenticated user hits):**
  - [client/app/context/AuthContext.js](client/app/context/AuthContext.js) — 3 sites (location load failure, invalid stored location, session verification failure).
  - [client/app/context/NotificationContext.js](client/app/context/NotificationContext.js) — 3 sites (sync, mark-read, clear-all failures).
- **Status:** ✅ Partially fixed (Wave 4). The high-traffic context-level sites that fire on every page load are now silenced in prod. ~40 dashboard-page console.errors remain — those are page-local and only fire on user actions, much lower noise. They can be codemodded incrementally without urgency now that the helper exists.

### LOW

#### 2.5 — `selection:text-black` in dark surface
- **File:** [client/app/dashboard/super-admin/page.js:56](client/app/dashboard/super-admin/page.js#L56)
- **Impact:** Black-on-blue is legible but suboptimal vs. white-on-blue. Pure polish.
- **Fix:** Changed `selection:text-black` → `selection:text-white`.
- **Status:** ✅ Fixed (Wave 2).

#### 2.6 — Global keydown blocks `.`, `-`, `e`/`E` on **every** `<input type="number">`
- **File:** [client/app/context/ThemeContext.js:42-72](client/app/context/ThemeContext.js#L42-L72)
- **Investigation:** Backend `menuItemSchema` validates with `isFloat()` (so decimals are technically allowed), but all seed prices are whole-rupee integers. This appears to be an **intentional INR-only "no paise" rule**, but it's enforced from `ThemeContext` (wrong file), is undocumented, and silently overrides any future field that legitimately needs decimals (e.g., commission %, weight, ratings).
- **Fix proposal:** Move the rule to a per-input policy (e.g., `data-allow-decimals` opt-in attribute) so legitimate decimal fields can opt out, **or** keep current behavior but document it clearly. Don't change without product confirmation — this is a design decision, not a bug.
- **Status:** 🟡 Backlog (needs product input).

#### 2.7 — `lucide-react@1.8.0` resolves to a real package
- **Verification:** Installed package matches the npm-published `lucide-react@1.8.0`. (Package was renumbered when it moved off the `0.x` line — not a supply-chain concern.)
- **Status:** 🔵 Watching (no action).

---

## Wave 5 — Audits run this session

### 5.1 Mongo schema indexes ✅ AUDITED + FIXED
Audited all 20 model files against actual query patterns in controllers and utils.
**Already-covered:** Transaction, Attendance, BranchStock, BranchInventory, Notification, Reservation, Booking, Table, Customer, Coupon, Location, Recipe, Ingredient, Payroll. These models already have indexes that match their hot query patterns.
**Added (Wave 4/5):**
- [server/models/Order.js](server/models/Order.js) — `{ branch: 1, status: 1, createdAt: -1 }` (hottest list/analytics filter); `{ table: 1, branch: 1, createdAt: -1 }` (anti-spam check + table billing).
- [server/models/MenuItem.js](server/models/MenuItem.js) — `{ category: 1 }`, `{ isGlobal: 1 }`, `{ availableBranches: 1 }`.
- [server/models/User.js](server/models/User.js) — `{ role: 1, assignedLocation: 1 }` (notification recipient resolution); `{ accessibleLocations: 1 }`.
- [server/models/AuditLog.js](server/models/AuditLog.js) — `{ performedBy: 1, timestamp: -1 }`, `{ locationId: 1, timestamp: -1 }`.

### 5.2 Full IDOR sweep ✅ AUDITED + FIXED
Audited every controller's `findById(req.params.id)` / `findByIdAndUpdate` / `findByIdAndDelete` patterns.
**Already scoped (no action):** orderController, reservationController, expenseController, tableController, bookingController, attendanceController, transactionController, salaryController, inventoryController, locationController, menuItemController, notificationController.
**Real read-only IDOR found and fixed:**
- [server/controllers/customerController.js](server/controllers/customerController.js) — `getCustomers` was already scoped, but `getTopCustomers`, `getInactiveCustomers`, and `getCustomerAnalytics` ran unscoped queries. A branch_admin could read top spenders / inactive list / aggregate stats from competing branches. Fixed via a shared `buildBranchFilter(req)` helper applied to every find / countDocuments / aggregate call. **Status:** ✅ Fixed.
**Ambiguous (flagged for product, not changed):**
- [server/controllers/categoryController.js](server/controllers/categoryController.js) `updateCategory` and [server/controllers/recipeController.js](server/controllers/recipeController.js) `deleteRecipe` mutate by id with no scope check — but the `Category` and `Recipe` schemas have no `locationId` field, so either (a) categories/recipes are intentionally global and the route's role gate is sufficient, or (b) they need a locationId field added first. Product decision required. **Status:** 🟡 Flagged.

### 5.3 N+1 query sweep ✅ AUDITED + FIXED
- [server/controllers/orderController.js:312-345](server/controllers/orderController.js#L312-L345) (was) — `for (const item of order.items) { await Recipe.findOne({ menuItemId: ... }) }`. For a 10-item order: 10 sequential queries on the order completion hot path. Refactored to one `Recipe.find({ menuItemId: { $in: ids } }).lean()` followed by an in-memory `Map` lookup. **Status:** ✅ Fixed.
- `attendanceController.getMonthlySummary` and `salaryController.getMySalaryHistory` were also flagged — both are bounded loops (per-user / 6-month) on cold paths. **Status:** 🟡 Backlog (low priority).

### 5.4 Socket abuse / emit volume ✅ MITIGATED
Connections are now authenticated (per Wave 0 work) and rooms are scope-checked, but a malicious authenticated client could spam `join_session` / `join_room` to drain CPU.
- [server/server.js](server/server.js) — added `makeRateGuard()` per-connection: max 30 events of a given type per 60s window, silently dropped beyond that. Also gated the connect/disconnect `console.log` lines behind `NODE_ENV === 'development'` so production doesn't emit a log line per socket lifecycle event.
**Status:** ✅ Fixed (Wave 5).

### 5.5 Bundle size analysis 🔵 REPORTED, NO CODE CHANGE
Production `next build` totals **5.7 MB** of static chunks. Largest single chunk: 466 KB. Four chunks at ~291 KB each — looks like a heavy vendor (framer-motion + recharts + lucide) is being bundled into multiple route entries. CSS bundle: 185 KB.
**Heavy deps contributing:** `framer-motion@12`, `recharts@3`, `jspdf@4` + `jspdf-autotable@5`, `html2canvas@1.4`, `papaparse@5.5`, `xlsx`-style export paths, `lucide-react@1.8`.
**Recommendation for a future wave:** dynamic-import `jspdf` / `html2canvas` / `papaparse` only on the export-flow pages that need them (currently ~370 KB of those libs is in the shared bundle). Recharts could be a candidate for `next/dynamic({ ssr: false })` on heavy analytics pages. **Status:** 🟡 Backlog (no code change this wave).

### 5.6 Mobile / tablet responsive QA — DEFERRED
Cannot do this honestly without a running browser at multiple viewport widths. Static `globals.css` review showed responsive utilities in place at `md:`/`lg:`/`@media` breakpoints, but visual confirmation is required. **Status:** 🟡 Needs running app.

### 5.7 Form a11y deep dive — DEFERRED
Needs screen reader testing (NVDA/VoiceOver) and keyboard-only navigation passes. Static pass would only catch the most obvious aria-label / label-association gaps. **Status:** 🟡 Needs running app + AT.

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

**Wave 2 — quick safe wins (~30 min): ✅ DONE**
- 1.9 ✅ Removed impersonation console.log calls (AuditLog covers it; folded viewOnly marker into AuditLog.details).
- 1.10 ✅ Added `ALLOW_DESTRUCTIVE_SEED` env-flag guard to the seed wipe endpoint.
- 2.5 ✅ `selection:text-black` → `selection:text-white` on super-admin page.

**Wave 3 — theme cleanup: ✅ DONE**
- 2.1 ✅ Real theme bugs fixed (super-admin amber-shadow leftover, dark zinc box on light card, hover text-white invisible in light mode, BottomNav active icon contrast). Several flagged lines were correct as-is and skipped — see entry 2.1 above.
- 2.2 ✅ Recharts tooltip uses CSS variables in `contentStyle`.
- 2.3 ✅ `URL.createObjectURL` previews migrated to `useEffect` + `revokeObjectURL` cleanup.

**Wave 4 — code hygiene: ✅ DONE (mostly)**
- 1.8 ✅ `.lean()` applied to 6 read-only listing/analytics paths (orderController × 4, userController, notificationController). Other paths were already optimized.
- 2.4 ✅ `clientLogger` helper added; high-traffic context-level call sites codemodded. Page-local sites can be migrated incrementally now that the helper exists.
- 2.6 🟡 Skipped — needs product input.

**Wave 5 — broader audits: ✅ DONE for code-actionable items**
- 5.1 ✅ Mongo indexes added on Order, MenuItem, User, AuditLog hot paths.
- 5.2 ✅ Full IDOR sweep — customerController fixed; categoryController/recipeController flagged for product.
- 5.3 ✅ N+1 in `updateOrderStatus` recipe lookup fixed.
- 5.4 ✅ Per-socket rate guard added; lifecycle logs gated on dev.
- 5.5 🔵 Bundle size reported (5.7 MB / largest 466 KB) — code splitting deferred to future wave.
- 5.6 🟡 Mobile/tablet QA — requires running app.
- 5.7 🟡 Form a11y — requires screen reader.

**Wave 6 — for whoever picks this up next:**
- Dynamic-import jspdf/html2canvas/papaparse on export pages only.
- Decide on `next/dynamic({ ssr: false })` for recharts on analytics pages.
- Codemod the remaining ~40 page-local `console.error` calls to `logger.error`.
- Confirm with product whether categories/recipes should be location-scoped (then add `locationId` + scope checks in those controllers).
- Mobile QA + a11y QA against a running deployment.

Pick a wave (or call out a specific subset) and I'll execute. Default safer choice is Wave 2.

