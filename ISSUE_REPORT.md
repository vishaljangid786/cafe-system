# CafeOS — Deep Audit & Fix Report

_Generated 2026-06-24 by a 33-agent adversarially-verified code audit (187 routes vs 325 client calls) + runtime testing (boot, all-role login, integration suite, ESLint) against the live local instance._

## Status of remediation (this session)

**Environment & data**
- MONGO_URI repointed from an unreachable Atlas placeholder to the working local MongoDB.
- Database fully re-seeded: 31 collections, full relations, 17 users matching QuickLogin (password `password123`), 600 orders, 529 transactions.
- Verified: server boots clean, all 6 roles log in (HTTP 200) and read data; integration suite 11/11.

**Fixes are being applied in order Critical -> High -> Medium -> Low.** See the live commit/diff for the authoritative state. Notable already-fixed items at time of writing: recipe ingredient-deduction corruption (critical), revenue GST-inclusive overstatement, daily-report ₹0, gift-card redeem against voided order + lost-update, table re-booking clobber, location_admin settings 403, chef KDS 20-order cap, Cafe Mongoose-9 hook crash, audit-logger crash, duplicate-index warnings.

---

## Executive Summary

**Health verdict: NEEDS ATTENTION — functional locally, but with one critical inventory-corruption bug, multiple money/reporting errors, and several role-specific features that are wholly broken (403s, dead links).** The system runs and the core authenticated order/billing happy-path works, but a number of user-facing features silently fail or produce wrong financial figures, and several roles (chef, location_admin, default admin) hit dead navigation or permission walls in normal use. Critically, recipe-based inventory auto-deduction drains the wrong stock on every order completion.

**Counts by severity:** Critical: 1 · High: 9 · Medium: 20 · Low: 37 (67 verified findings)

**Top "not working" items the user asked about:**

- **CRITICAL — Inventory silently corrupted on every order:** Recipe lines never carry an Ingredient id, so order completion decrements an *arbitrary* inventory row instead of the real ingredient. Stock, low-stock alerts, and COGS all drift. (`server/services/inventoryService.js:29-35`)
- **HIGH — Daily revenue report is permanently ₹0:** The scheduled Super-Admin report filters Transactions on a non-existent status `'completed'`, so Total Revenue never matches a document. (`server/utils/scheduler.js:45-48`)
- **HIGH — Cross-tenant money leak:** The platform-wide executive-summary endpoint (all-branch revenue, profit, rankings) is gated by the *delegable* `viewAdminCenter` permission — granting it to an admin/branch_admin exposes every cafe's financials. (`server/controllers/superAdminController.js:12-103`)
- **HIGH — Payslip overpays absent staff:** The printed payslip uses full monthly salary as Net Payable, ignoring attendance/prorated pay — up to 3× overstated on an official document. (`client/app/dashboard/admin/payroll/page.js:595-601`)
- **HIGH — Gift card drainable against voided orders:** `redeemGiftCard` never checks order status, so prepaid balance can be consumed against a CANCELLED/REJECTED order with no offsetting sale and no auto-reversal. (`server/controllers/giftCardController.js:96-114`)
- **HIGH — "Login As" 403s for every default admin:** The Impersonate page shows active buttons to admins who lack `impersonateUsers`; every click 403s. (`client/app/dashboard/admin/impersonate/page.js:76` vs `server/routes/authRoutes.js:46`)
- **HIGH — location_admin Settings save always 403s:** The role can open Settings and edit, but the PUT route omits `location_admin`. (`server/routes/settingsRoutes.js:11`)
- **HIGH — Active table can be re-booked:** `bookTable` checks only `isBooked` (never `status`), so a table with live kitchen orders can be clobbered by a new walk-in. (`server/controllers/tableController.js:135-169`)
- **HIGH — Kitchen tickets silently vanish under load:** The chef KDS fetches only the 20 newest orders with no status filter; on a busy branch, active tickets fall outside the window and never render. (`client/app/dashboard/chef/page.js:56-60`)
- **HIGH — Chef navigation is mostly dead:** Sidebar Performance/Branch-Menu links point at `/dashboard/staff/*`, which the layout guard bounces back to Kitchen. (`client/app/components/Sidebar.js:220,259-263`)

See the **Broken / Mismatched APIs** and **Broken Buttons & Dead Links** quick-reference tables below for the consolidated "doesn't work" list.

---

## Critical

### Recipe lines carry no Ingredient ObjectId, so order completion decrements an arbitrary inventory row

**Severity: Critical | Category: Logic | Location: `server/services/inventoryService.js:29-35`; `client/app/dashboard/admin/menu/page.js:401,1526-1561`; `server/controllers/recipeController.js:50-85`**

**Impact:** Recipe-based auto-deduction silently corrupts stock on every order completion. The recipe editor only collects free-text `{name, quantity, unit}` per ingredient and never sets `ingredient` (the Ingredient ObjectId); `upsertRecipe` stores it verbatim. On order completion, `deductIngredientsFromRecipe` runs `BranchInventory.findOneAndUpdate({ branch, ingredient: ingredientInfo.ingredient }, ...)` with `ingredient === undefined`. Mongoose strips undefined filter keys, so the filter collapses to `{ branch }` and the update decrements the **first/arbitrary** inventory document for that branch. The wrong ingredient is drained, real usage is never tracked, low-stock alerts and purchase suggestions become meaningless, and COGS/inventory valuation drift. Unlike the order-time precheck in `orderService` (which has `if (!ingredientInfo.ingredient) continue;`), the deduction service has **no** such guard — so a UI-created free-text recipe passes the precheck and then silently corrupts stock.

**Evidence:**
```js
// server/services/inventoryService.js:29-35
for (const ingredientInfo of recipe.ingredients) {
  const deductionQuantity = ingredientInfo.quantity * item.quantity;
  await BranchInventory.findOneAndUpdate(
    { branch: branchId, ingredient: ingredientInfo.ingredient }, // ingredient === undefined
    [{ $set: { stock: { $max: [0, { $subtract: ['$stock', deductionQuantity] }] } } }]
  );
}
```
The recipe editor (`menu/page.js:401`) builds rows as `{ name: '', quantity: '', unit: 'grams' }` with no `ingredient` id; the form (lines 1526-1561) has only Name/Qty/Unit inputs — no Ingredient picker. Empirically confirmed: `M.findOneAndUpdate({branch:'B1', ingredient:undefined}).getFilter()` === `{branch:'B1'}`. The `Recipe` schema *does* define an `ingredient` ObjectId field (`models/Recipe.js:13-16`) but it is not required and never populated by the UI. Invoked on order completion at `orderFinalizer.js:105`.

**Fix:** Add an Ingredient picker to the recipe editor that stores the selected Ingredient `_id` in each line, and in `inventoryService.deductIngredientsFromRecipe` add `if (!ingredientInfo.ingredient) continue;` (mirroring `orderService`) so a line without a resolved id is skipped rather than draining an arbitrary row. Optionally, resolve free-text names to Ingredient ids in `upsertRecipe`, or reject recipe lines lacking an ingredient id.

---

## High

### Scheduled daily report filters Transactions on non-existent status `'completed'`, so Total Revenue is always ₹0

**Severity: High | Category: Money | Location: `server/utils/scheduler.js:45-48`**

**Impact:** The automated daily Super-Admin report's "Total Revenue" line is permanently ₹0. The Transaction status enum is `['pending','approved','rejected']` (`Transaction.js:89`) — `'completed'` is never a valid value, so the `$match` matches nothing and `totalRevenue[0]?.total || 0` renders ₹0. The query also omits a `type` filter (so a corrected status would wrongly sum EXPENSE rows) and matches on `createdAt` while revenue transactions carry an authoritative `date` field. Owners receive a daily report that silently understates revenue to zero.

**Evidence:**
```js
const totalRevenue = await Transaction.aggregate([
  { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay }, status: 'completed' } },
  { $group: { _id: null, total: { $sum: '$totalAmount' } } }
]);
```
vs `Transaction.js:89` `enum: ['pending', 'approved', 'rejected']`. Every creation path assigns `status: 'approved'` (`orderFinalizer.js:125`, seed data) and never `'completed'`.

**Fix:** Match the real schema and use the `date` field: `{ $match: { type: { $in: ['REVENUE','POS_REVENUE','MANUAL_REVENUE'] }, status: 'approved', date: { $gte: startOfDay, $lte: endOfDay } } }`. (Note the Transaction `type` enum is `['REVENUE','POS_REVENUE','MANUAL_REVENUE','EXPENSE']`, so use the `$in` list to avoid excluding POS/manual revenue, matching `analyticsService.js`.)

### Delegable `viewAdminCenter` permission exposes unscoped platform-wide revenue to non-super-admins

**Severity: High | Category: Data-Isolation | Location: `server/controllers/superAdminController.js:12-103`; `server/routes/superAdminRoutes.js:7`**

**Impact:** `GET /api/super-admin/executive-summary` aggregates revenue, today's revenue, net profit, branch ranking, and top performers across **all** branches/cafes with no location/cafe scoping. The route gate is `checkRoleOrPermission(['super_admin'], 'viewAdminCenter')`, and `viewAdminCenter` is a delegable permission (exposed in PermissionManager, add-member, signup, and grantable via `updateUserPermissions`/`registerUser`). Granting it to an admin, branch_admin, or location_admin lets that user read the entire platform's financials — a cross-tenant money/data leak.

**Evidence:** `superAdminRoutes.js:7` — `router.get('/executive-summary', checkRoleOrPermission(['super_admin'], 'viewAdminCenter'), getExecutiveSummary);`. `getExecutiveSummary` has zero branch filtering: `Order.aggregate([{ $match: { status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }])` (`:14-17`), branchRanking groups over all `'$branch'` (`:34-59`), `netProfit = totalRevenue * 0.4` (`:31`). The permission is in `ALL_PERMISSION_KEYS` (`userController.js:676`, `authController.js:212`) and the actor-grant gate (`userController.js:691-697`) only blocks granting keys the actor lacks.

**Fix:** Either restrict the endpoint to role `super_admin` only (drop `viewAdminCenter` from the gate), or scope every aggregation by `req.user`'s accessible locations/cafes for non-super-admins (e.g. add `{ $match: { branch: { $in: userLocationIds(req.user) } } }` when `req.user.role !== 'super_admin'`).

### Printed payslip uses full monthly salary, not the prorated payout — overpays absent/half-day staff

**Severity: High | Category: Money | Location: `client/app/dashboard/admin/payroll/page.js:595-601`**

**Impact:** "Print Payslip" generates the employee-facing payslip with Base Salary = full `monthlySalary` and Net Payable = `monthlySalary + bonus - penalty`, ignoring attendance/`payableDays`. A staff member who worked 10 of 30 days gets a printed payslip showing the **full** monthly salary as net payable. This authoritative finance document contradicts both the on-screen modal (which correctly shows `payrollRecord.netSalary || calculatedSalary`, line 587) and the amount posted to the ledger, driving incorrect payments and disputes.

**Evidence:**
```js
const net = (s.monthlySalary || 0) + bonus - penalty;  // line 599 — full monthlySalary
// line 601 writes <td>Base Salary</td><td>₹${(s.monthlySalary||0)...}</td> and Net Payable=net
// contrast modal line 587: (viewingSalary.payrollRecord?.netSalary || viewingSalary.calculatedSalary || 0)
```
`s.calculatedSalary` is the prorated `(monthlySalary/daysInMonth)*payableDays`; `s.payrollRecord.netSalary` is what is posted to the Expense ledger (`salaryController.js:468`). It renders a print document only (does not itself post a ledger entry or move money), but the figure is wrong.

**Fix:** Compute the payslip net from the prorated figure: `const net = s.payrollRecord?.netSalary ?? Math.round(s.calculatedSalary || 0);` and label the prorated base (`dailyRate * payableDays`) rather than `monthlySalary`, mirroring the modal so the printed slip matches both the screen and the ledger.

### `bookTable` only checks `isBooked` (never `status`), so a table with live orders can be re-booked and clobbered

**Severity: High | Category: Logic | Location: `server/controllers/tableController.js:135-169`**

**Impact:** When an order is placed, the order flow sets `status:'ongoing'` but leaves `isBooked=false` (`orderService.js:311-315`; `updateOrders` also sets `status` without `isBooked`). `bookTable` guards solely on `if (table.isBooked)`. A table already carrying active kitchen orders — including ones placed via the **unauthenticated** `POST /api/public/order` endpoint — passes the guard: staff can "book" it for a new walk-in, overwriting `customerName`/`numberOfPeople`, resetting status to `booked`, and leaving the existing Order docs attached and `activeOrdersCount` stale. Lost customer context and floor-state corruption (the existing Orders are not deleted, and downstream billing still blocks clearing a table with live kitchen orders).

**Evidence:** `tableController.js:146-167` — `if (table.isBooked) { ...throw 'Table is already occupied'; } ... table.status = 'booked';`. `orderService.js:311-315` — `Table.findByIdAndUpdate(tableId, { status: 'ongoing', $inc: { activeOrdersCount: 1 } })` (no `isBooked`); `updateOrders` sets `table.status='ongoing'` (`:295`) without `isBooked`.

**Fix:** Guard on operational state: reject when `table.isBooked || ['booked','ongoing'].includes(table.status) || (table.activeOrdersCount||0) > 0`. Equivalently, keep `isBooked` in sync wherever `status` becomes `'ongoing'`, or derive "occupied" from `status` alone everywhere.

### Gift card can be redeemed against a CANCELLED/REJECTED order, draining prepaid balance for a voided sale

**Severity: High | Category: Money | Location: `server/controllers/giftCardController.js:96-114`**

**Impact:** `redeemGiftCard` only guards `order.isRefunded`; it never checks `order.status`. A CANCELLED/REJECTED order keeps its `totalAmount` (never zeroed) with `grandTotal=0` and `amountPaid=0`, so `orderPayable()` derives a positive bill and `outstanding > 0`. A cashier with `manageOrders` can redeem a customer's gift-card balance against an order that was voided and for which no goods are delivered — the prepaid liability is consumed with no offsetting sale. Because the order is not COMPLETED/refunded, the reversal path (`orderController.refundOrder`, which requires `status==='COMPLETED' && isBilled`) can never restore it.

**Evidence:** `giftCardController.js` — `const order = await Order.findById(orderId); ... if (order.isRefunded) { throw ... }` then `const outstanding = Math.max(0, orderTotal - Number(order.amountPaid || 0))` with no status check. `orderPayable()` (`:11-22`) derives a positive total from `order.totalAmount` when `grandTotal<=0`. The atomic card debit (`findOneAndUpdate`, `:136-140`) then drains real balance.

**Fix:** Before computing `outstanding`, reject non-billable orders: `if (['CANCELLED','REJECTED'].includes(order.status)) { res.status(400); throw new Error('Cannot redeem against a cancelled or rejected order'); }`.

### Impersonate page shows "Login As" to admins lacking `impersonateUsers`, so every click 403s

**Severity: High | Category: RBAC | Location: `client/app/dashboard/admin/impersonate/page.js:76`; `server/routes/authRoutes.js:46`**

**Impact:** The "Login As User" feature is fully broken for the **default `admin`** role. The page admits role `admin` unconditionally and renders active "Login As" buttons, but the server route allows only `super_admin` OR the `impersonateUsers` permission — which admins do not hold by default. A default admin sees the buttons, clicks one, gets a 403 toast, and can never impersonate. The page is reachable in normal navigation via the layout's `/dashboard/admin` prefix.

**Evidence:** `page.js:76` guard — `if (user && !['super_admin','admin','branch_admin'].includes(user.role) && !user.permissions?.impersonateUsers && !user?.impersonatedBy)` admits `admin` (no redirect). `authRoutes.js:46` — `checkRoleOrPermission(['super_admin'], 'impersonateUsers')`. Default perms (`authController.js:189-190`) for admin do not set `impersonateUsers` (`User.js:91` default false). (Note: a default `branch_admin` is bounced earlier by the layout guard and does not reach this page, so the bug is specific to the `admin` role.)

**Fix:** Align the gates: either add `'admin'` to the route's roles array, or (safest) gate the page and "Login As" button on the same condition as the server — render only when `user.role === 'super_admin' || user.permissions?.impersonateUsers`.

### `location_admin` can open Settings and edit fields but every Save 403s (route excludes the role)

**Severity: High | Category: RBAC | Location: `server/routes/settingsRoutes.js:11` (vs `client/app/components/Sidebar.js:175`, `client/app/dashboard/admin/settings/page.js:71,108-123`)**

**Impact:** A `location_admin` is shown the Settings nav item, opens the page (GET `/settings` is readable by all roles), edits tax/billing/payroll/loyalty values, and clicks "Save settings". The client PUTs `/api/settings` with their `locationId`. The route guard `checkRoles('super_admin','admin','branch_admin')` omits `location_admin`, so the request 403s before reaching `updateSettings` (which itself *would* have authorized them via `canAccessLocation`). Settings management is completely non-functional for the role despite the UI implying it works.

**Evidence:** `Sidebar.js:175` pushes Settings unconditionally for `location_admin`; `dashboard/layout.js` whitelists `/dashboard/admin/settings` for the role (no redirect). `settings/page.js:71` `isPinned = role==='location_admin'`, save at `:116` `api.put('/settings', payload)`. `settingsRoutes.js:11` `.put(checkRoles('super_admin','admin','branch_admin'), updateSettings);` — location_admin omitted. `settingsController.js:37` would have allowed it via `canAccessLocation`.

**Fix:** Add `'location_admin'` to the PUT route's `checkRoles` list. The controller already branch-scopes location_admin saves (rejects null/global `locationId` for non-super-admins and enforces `canAccessLocation`), so this is safe.

### Chef kitchen deck only fetches the 20 most-recent orders, so active tickets silently disappear under load

**Severity: High | Category: Broken-API | Location: `client/app/dashboard/chef/page.js:56-60`**

**Impact:** The KDS fetch `GET /orders?branchId=<id>` passes no limit and no status filter, so the server returns only the 20 most-recent orders of **all** statuses (`accessControl.js:127` `clampLimit` default 20), then the client post-filters to active statuses. On any branch with >20 orders for the day, recent SERVED/COMPLETED/CANCELLED orders consume the 20-row window and genuinely active tickets (older by `createdAt`) never reach the kitchen — they vanish from every lane with no error. The socket-driven refetch uses the same 20-limit query, so it cannot recover them.

**Evidence:**
```js
const res = await api.get(`/orders?branchId=${branchId}`); // no limit/status/date
const activeStatuses = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'];
const activeOrders = res.data.data.filter(o => activeStatuses.includes(o.status)); // server already capped at 20
```
`getOrders` (`orderController.js:130-145`) `.sort({ createdAt: -1 }).limit(clampLimit(req.query.limit, 20))`.

**Fix:** Ask the server for only the active, un-served tickets instead of post-filtering a 20-row page — add an `activeOnly=true`/`status=$in[...]` server-side filter (and remove finished statuses), returning all open tickets regardless of the day's total count.

### Chef Sidebar "Performance" group + "Branch Menu" link to `/dashboard/staff/*` which the layout guard bounces — chef nav is dead

**Severity: High | Category: RBAC | Location: `client/app/components/Sidebar.js:220,259-263`; `client/app/dashboard/layout.js:39,116-128`**

**Impact:** For `role=chef` the Sidebar renders "Branch Menu" → `/dashboard/staff/menu`, "My Performance" → `/dashboard/staff/performance`, "Work History" → `/dashboard/staff/work-history`, "My Attendance" → `/dashboard/staff/attendance`. `ROLE_PREFIX.chef = ['/dashboard/chef']` only; none of those `/dashboard/staff/*` paths are shared or permission-granted, so the guard runs `router.replace('/dashboard/chef')`. Four chef links bounce straight back to Kitchen — the chef can never reach the menu, performance, work history, or attendance. Only Kitchen and Expenses work. A correct page `/dashboard/chef/performance` exists but the sidebar points to the staff one.

**Evidence:** `Sidebar.js:220` `opsItems.push({ name: 'Branch Menu', href: '/dashboard/staff/menu' });` and `:259-263` performance items at `/dashboard/staff/*`. `layout.js:39` `chef: ['/dashboard/chef'],`; `:126-128` `if (!canAccess && !hasPagePerm) { router.replace(allowed[0]); }`. Route dirs: `/dashboard/chef` contains only `expenses` and `performance` (no work-history/attendance/menu).

**Fix:** Repoint "My Performance" to the existing `/dashboard/chef/performance`. For the others, either create chef equivalents or whitelist the needed `/dashboard/staff/*` paths for chef (add to `ROLE_PREFIX.chef`/`SHARED_PREFIXES`). Keep Sidebar and BottomNav consistent with whichever path is chosen.

---

## Medium

### `client/.env` sets `NEXT_PUBLIC_API_URI` but code reads `NEXT_PUBLIC_API_URL` — .env is ignored

**Severity: Medium | Category: Config | Location: `client/.env:1`; `client/app/services/api.js:20`; `client/app/services/socketUrl.js:10`**

**Impact:** The only env var configuring the API base URL and Socket.IO URL is `NEXT_PUBLIC_API_URL`, but `client/.env` defines `NEXT_PUBLIC_API_URI` (trailing I vs L). The names differ, so `client/.env` is dead config — both `resolveBaseURL()` and `getSocketUrl()` fall back to the hardcoded `http://localhost:5000/api`. Harmless in local dev (the fallback equals the intended value), but any deployment relying on `client/.env` to point the browser at a real API host silently keeps calling localhost:5000 — a dead app in that environment, with no build/runtime error to surface the typo.

**Evidence:** `.env:1` `NEXT_PUBLIC_API_URI="http://localhost:5000/api"`; `api.js:20` and `socketUrl.js:10` both read `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'`. Repo-wide grep finds no code reading `NEXT_PUBLIC_API_URI`. (The socket URL has a separate `NEXT_PUBLIC_SOCKET_URL` override; the typo specifically kills the API base URL.)

**Fix:** Rename the key in `client/.env` to `NEXT_PUBLIC_API_URL`, or accept both names in code: `process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URI || 'http://localhost:5000/api'`. Prefer fixing the key to avoid masking future typos.

### Logout while impersonating bumps the impersonated target's `sessionVersion`, not the operator's

**Severity: Medium | Category: Logic | Location: `server/controllers/authController.js:419-437`; `server/middlewares/authMiddleware.js:50-64`**

**Impact:** `logoutUser` revokes sessions for `req.user._id`. During impersonation, `req.user` is the **impersonated target** (the token was issued for the target), while the real operator is `req.impersonator`. If an operator hits `POST /api/auth/logout` while impersonating (the Sidebar Logout button is still rendered), it increments the *target's* `sessionVersion` — invalidating that user's own real login sessions everywhere — instead of ending impersonation, and it does not revoke the operator's underlying session. Reachable in the UI alongside the correct "Exit Session" banner.

**Evidence:** `authController.js:423-425` `if (req.user?._id) { await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } }); }`. During impersonation `req.user` is the target and `req.impersonator` is the operator (`authMiddleware.js:51`); the logout path never consults `req.impersonator`.

**Fix:** In `logoutUser`, if `req.impersonator` is present, do not bump the target's `sessionVersion` (treat it as exit-impersonation); only bump for a genuine non-impersonated logout.

### `OrderService.updateItems` uses an unconditional transaction with no standalone-Mongo fallback (500 on standalone MongoDB)

**Severity: Medium | Category: Crash | Location: `server/services/orderService.js:487-603` (esp. 489-490)**

**Impact:** `PATCH /api/orders/:id/items` opens a session and calls `session.startTransaction()` unconditionally. On standalone MongoDB (the user's local deploy), the first session-scoped write throws "Transaction numbers are only allowed on a replica set member or mongos" → 500. Unlike `createOrder` (which retries non-atomically on `isTransactionUnsupportedError`), `updateItems` has no fallback. Latent rather than live: no client UI currently calls `PATCH /:id/items` (the admin UI restructures via `POST /:id/split`), so it is an API-level defect, not a broken screen today.

**Evidence:** `createOrder` (`:39-48`) try/catches and retries `_createOrder(...,false)`; `updateItems` (`:489-490`) does `const session = await mongoose.startSession(); session.startTransaction();` with the catch (`:598-601`) calling `await session.abortTransaction()` unguarded. Grep confirms only `_createOrder` consults `isTransactionUnsupportedError`.

**Fix:** Refactor `updateItems` like `createOrder`: extract `_updateItems(orderId, items, userId, useTransaction)` with a nullable session, and wrap a public `updateItems` that calls with `true` then retries with `false` when `isTransactionUnsupportedError(err)`.

### `finalizeOrder` records GST/service-inclusive `grandTotal` as the revenue Transaction amount, inflating reported revenue

**Severity: Medium | Category: Money | Location: `server/utils/orderFinalizer.js:112-122`; consumed at `server/controllers/analyticsController.js:399`, surfaced in `client/app/dashboard/admin/revenue/page.js:114-125`**

**Impact:** The REVENUE Transaction is written with `totalAmount = order.grandTotal` = `(subtotal - discount) + serviceCharge + GST`. Analytics aggregations sum `Transaction.totalAmount` as sales revenue, and the admin revenue page renders that sum **plus** a separate "GST collected" widget — double-surfacing GST (a pass-through liability) and the service charge. The Order model itself documents revenue must be GST-exclusive (`Order.js:176-178,189-190`). Net: reported revenue is overstated by GST + service charge, corrupting P&L/sales reporting.

**Evidence:** `orderFinalizer.js:122` `totalAmount: Number(order.grandTotal || order.totalAmount || 0)` where `grandTotal` (`:39-50`) = `_taxable + serviceCharge + taxAmount`. `Order.js:189-190` defines `totalAmount` as the GST-exclusive revenue value. `analyticsController.js:399` `revenue: { $sum: '$totalAmount' }`.

**Fix:** Record the GST-exclusive sales value (e.g. `totalAmount = subtotal - discount`, or `+ serviceCharge` if treated as income) as the revenue figure, keeping `grandTotal`/`taxAmount`/`serviceCharge` as separate fields. Align analytics to sum the GST-exclusive field so the GST widget is purely additive.

### Seeded `branch_admin` lacks `viewRevenue`/`editRevenue`, so the Revenue/Expenses screens 403

**Severity: Medium | Category: RBAC | Location: `server/seed/data.js:93` (gate: `server/routes/transactionRoutes.js:15-17`)**

**Impact:** The seeded `branch_admin` is created with permissions `{ viewOrders, manageOrders, manageStaff, viewAnalytics }` only. The Revenue/Expenses screens call `/api/transactions`, gated on `viewRevenue` (GET) and `editRevenue` (POST). On a freshly-seeded "running locally live" system, the branch admin's Revenue/Expenses screens 403 with an error state. This is inconsistent with the registration default (`authController.js:191`), which grants `branch_admin` `viewRevenue`/`editRevenue` — so behavior silently depends on provisioning path. Salary/attendance still work (they only need `manageStaff`).

**Evidence:** `seed/data.js:93` permissions omit revenue perms. `transactionRoutes.js:15-17` gate GET on `viewRevenue`, POST on `editRevenue`. `authController.js:191` `branch_admin: { viewRevenue: true, editRevenue: true, ... }`. (Note: the breaking routes are `/api/transactions`, not `/api/expenses` — no client screen calls `/expenses`.)

**Fix:** Make the seed `branch_admin` permissions match the registration default (add `viewRevenue`, `editRevenue`, `exportReports`, `forceComplete`). Better: have the seed derive permissions from the same `DEFAULT_ROLE_PERMISSIONS` map used by `registerUser` so they cannot drift.

### No leave balance/quota: staff can request unlimited fully-paid leave

**Severity: Medium | Category: Money | Location: `server/controllers/leaveRequestController.js:22-62,120-136`; `server/models/LeaveRequest.js`; `server/models/User.js`**

**Impact:** `createLeaveRequest` only caps a single request at 90 days; there is no per-user paid-leave allowance or consumption check. On approval, paid/sick/casual leave stamps Attendance status `'leave'`, which `getSalaryAggregation` counts as fully payable (`salaryController.js:96-103`). An employee can submit repeated approved paid-leave requests for a whole month and be paid full salary for zero worked days. There is no accrual or balance enforcement. (Requires an approver to rubber-stamp each request — not a self-service exploit.)

**Evidence:** `leaveRequestController.js:48` coerces `type` with no balance check; `:123` `attStatus = leave.type === 'unpaid' ? 'absent' : 'leave'`. `salaryController.js:80,96-103` count `'leave'` days as fully payable. No `leaveBalance`/`quota` field exists in either model.

**Fix:** Add a paid-leave allowance per user (quota on User or a `LeaveBalance` model), decrement atomically on approval, and reject paid/sick/casual requests exceeding the remaining balance — overflow days should stamp `'absent'` (unpaid).

### Dashboards show `calculatedSalary` but the ledger posts a different `netSalary`

**Severity: Medium | Category: Money | Location: `server/controllers/salaryController.js:121-127` (calculatedSalary) vs `387-409` + `468` (netSalary)**

**Impact:** Salary lists/totals and `totalPayrollCost` use `calculatedSalary = (monthlySalary/daysInMonth)*payableDays` (unrounded, no OT/penalties). The `Payroll.netSalary` posted to the Expense ledger uses `round(monthlySalary/daysInMonth)*payableDays + overtimePay - latePenalties`. These diverge even with no OT/penalties (rounding of the daily rate) and more once penalties/OT apply. The "Total Salary Payout" managers see does not reconcile with what is booked as a Salary expense.

**Evidence:** `salaryController.js:121-126` `calculatedSalary: { $multiply: [{ $divide: ['$monthlySalary', daysInMonth] }, '$payableDays'] }`; `:387` `dailyRate = Math.round(monthlySalary/daysInMonth)`; `:409` `netSalary = max(0, baseSalary + overtimePay - latePenalties - absentPenalties)`; `:468` ledger gets `payroll.netSalary`.

**Fix:** Pick one source of truth: surface generated `Payroll.netSalary` (and components) on dashboards/totals when a Payroll record exists, falling back to `calculatedSalary` only as a pre-generation estimate. Compute `totalPayrollCost` from the same net figure posted to the ledger.

### Reservations never mark the reserved Table booked, so a reserved table can be walk-in booked / publicly ordered

**Severity: Medium | Category: Logic | Location: `server/controllers/reservationController.js:199-216`; `server/controllers/tableController.js:135-169`**

**Impact:** `createReservation` only writes a Reservation document with `tableIds`; it never updates the referenced Table rows. `bookTable` and `updateOrders` make no reservation check. So a table reserved for later still reads `isBooked=false` and can be seated to a walk-in via `PUT /tables/:id/book`. (The order-time path does look up an active reservation and *deliberately* links rather than blocks the order, and public bookings account for reservation capacity — so the genuinely unguarded vector is the manual `bookTable` walk-in.)

**Evidence:** `reservationController.js:199-216` creates the Reservation with no Table write; `tableController.js` `bookTable`/`updateOrders` never query `Reservation`. Contrast `waitlistController.js:105-113` which marks the table booked on seat.

**Fix:** In `bookTable` (and ideally `updateOrders`), before seating a walk-in, query `Reservation` for a confirmed reservation overlapping now whose `tableIds` include this table (mirror `orderService.js:74-84`) and reject/warn. Optionally set the reserved Table(s) status during an active window.

### `getAdvancedAnalytics` destructures 5 vars from a 4-element `Promise.all`, so `recentRevenues` is always undefined

**Severity: Medium | Category: Logic | Location: `server/services/analyticsService.js:290-331`**

**Impact:** The admin dashboard's "Recent Sales/Revenues" widget is permanently empty. `getAdvancedAnalytics` returns `recentRevenues` as undefined, and the array element that actually holds the revenue rows is captured into the unused `recentManualExpenses`. The client renders `analytics.recentRevenues` (`admin/page.js:435`), always empty → "No recent sales found." (Recent Expenses still works.)

**Evidence:** `const [staffAgg, categoryAgg, recentTransactions, recentManualExpenses, recentRevenues] = await Promise.all([... 4 promises ...]);` — element 2 (EXPENSE find) → `recentTransactions` (reused correctly as `recentExpenses`), element 3 (non-EXPENSE/revenue find) → `recentManualExpenses` (orphaned), `recentRevenues` → undefined; the return ships `recentRevenues: undefined` (`:331`).

**Fix:** Rename to 4 names that line up: `const [staffAgg, categoryAgg, recentExpenses, recentRevenues] = await Promise.all([...])` where element 2 is the EXPENSE find and element 3 is the non-EXPENSE (revenue) find. Remove the redundant `const recentExpenses = recentTransactions;`.

### CSV export does not neutralize formula characters (`=`, `+`, `-`, `@`) — CSV/formula injection

**Severity: Medium | Category: Security | Location: `server/utils/exportService.js:5-10` via `server/controllers/exportController.js`**

**Impact:** User-controllable fields (Customer/customerName, Items/itemName, Description, Guest/guestName, Reason, Category) are written verbatim into CSV. `json2csv@6.0.0-alpha.2` does not escape leading `=`,`+`,`-`,`@`,tab. When the export is opened in Excel/Sheets, a cell like `=HYPERLINK("http://evil",...)` is interpreted as a formula, enabling data exfiltration or command execution on the admin's machine. Exploitation requires injecting a crafted value, an admin exporting and opening in a spreadsheet app, and clicking through modern warnings — defense-in-depth gap rather than guaranteed RCE.

**Evidence:** `exportService.js` `const json2csvParser = new Parser({ fields }); return json2csvParser.parse(data);` — no sanitization. `exportController.js` orders case maps `Customer: o.customerName`, `Items: o.items.map(...)`.

**Fix:** Sanitize string cells before generation: `const safe = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) ? "'" + v : v;` applied to every field, or switch to a CSV writer with formula-escaping enabled.

### Expense detail "Download Receipt" button has no `onClick` (does nothing)

**Severity: Medium | Category: UI-Broken | Location: `client/app/dashboard/admin/expenses/page.js:708-714`**

**Impact:** In the expense detail modal, for any non-pending expense the primary action is a "Download Receipt" button with no `onClick` handler — clicking does nothing (no feedback, no download, no error). The receipt image, when present, is only shown inline as an `<img>` at `:682`; there is no download wiring.

**Evidence:** Lines 708-714: `<Button variant="primary" ... icon={Download}>Download Receipt</Button>` — no `onClick`. Contrast the sibling Close button at `:715` which has `onClick`.

**Fix:** Wire an `onClick` that opens/downloads `selectedExpense.billImage` (e.g. `window.open(...)` or an anchor with `download`), disable/hide when no `billImage`, or remove it.

### Editing a coupon re-runs "expiry must be in the future" validator, blocking edits of expired coupons

**Severity: Medium | Category: Logic | Location: `server/middlewares/validateMiddleware.js:98-103` applied on PUT in `server/routes/couponRoutes.js:27`; `client/app/dashboard/admin/coupons/page.js:146,549`**

**Impact:** `PUT /coupons/:id` runs the full `couponSchema`, which requires `expiryDate` strictly in the future. The edit modal pre-fills `expiryDate` from the existing coupon (UTC midnight). To toggle `isActive`, fix a discount, or extend an already-expired/expiring-today coupon, the unchanged old expiry fails with 422 "Expiry date must be in the future" — so admins cannot edit or re-activate lapsed coupons. The controller `updateCoupon` (`couponController.js:102-105`) re-checks the same condition, so both layers need fixing.

**Evidence:** `validateMiddleware.js:98-103` `.custom((value) => { if (new Date(value) <= new Date()) throw ... })`. `couponRoutes.js:27` `.put(checkPermissions('manageCoupons'), ...couponSchema, validate, updateCoupon)`. `coupons/page.js:549` pre-fills `toISOString().split('T')[0]`.

**Fix:** Use a separate, looser schema for PUT (relax the future-date check on update, or only enforce when `expiryDate` is actually changed), or compare against start-of-day so same-day expiries pass.

### `location_admin` Salary/Attendance/Staff pages 403 by default (manageStaff not granted)

**Severity: Medium | Category: RBAC | Location: `client/app/dashboard/location-admin/salary/page.js:33`; `.../attendance/page.js:33-36`; `.../staff/page.js:32,71,84`**

**Impact:** A default `location_admin` can reach these pages by direct URL (the layout's `ROLE_PREFIX` allows any `/dashboard/location-admin/*` path), but the APIs they call are gated on `manageStaff`, which `location_admin` lacks by default (`authController.js:192`). The salary page shows "Could not load salary records", attendance shows a toast + empty roster, staff shows "Failed to load staff list". (The Sidebar hides these links for the default role, so they are only reachable by direct URL — not clicked from anywhere.)

**Evidence:** `authController.js:192` `manageStaff: false`. `salaryRoutes.js:22`, `attendanceRoutes.js:25-28` wrap in `checkPermissions('manageStaff')`; `userRoutes.js:25` `router.use(checkPermissions('manageStaff'))`. `api.js:77-79` only converts 404-GET to empty data; 403 rejects.

**Fix:** Pick a consistent model: give `location_admin` a (read-only) `manageStaff` default, or guard the pages/links the same way the location-admin Expenses page guards "Add Expense" behind `editRevenue`. At minimum, render an explicit "no permission" state on 403, and permission-gate the location-admin subpaths instead of allow-all-by-prefix.

### `branch_admin` Revenue & Expenses pages ignore the Navbar branch switcher

**Severity: Medium | Category: Data-Isolation | Location: `client/app/dashboard/branch-admin/revenue/page.js:24,34-55`; `.../expenses/page.js:66-92`**

**Impact:** For a branch_admin managing multiple branches, picking a single branch in the global switcher has no effect on these screens. The fetches build queries with only the date range and never append `locationId`, so the server returns `{ $in: <all assigned branches> }` and the page always shows every branch's revenue/expenses merged. The branch-admin Salary page *does* honor `selectedLocation`, so behavior is inconsistent within the same role. Not cross-tenant (still the admin's own branches), but the money totals shown contradict the user's selection.

**Evidence:** `revenue/page.js:24` destructures `selectedLocation` but `fetchRevenue` (`:40-51`) only appends `startDate`; `useEffect` deps are `[timeRange]`. `expenses/page.js` never appends `locationId`. Contrast `salary/page.js:38-40` which appends `locationId` for a single branch.

**Fix:** In the branch-admin revenue/expenses fetches, append `locationId` from `selectedLocation` when a single branch is selected (mirroring `salary/page.js`), and add `selectedLocation` to the `useEffect` deps so the list refetches on branch switch.

### `branch_admin` Tables page shows all branches merged and always adds tables to `assignedLocation`

**Severity: Medium | Category: Data-Isolation | Location: `client/app/dashboard/branch-admin/tables/page.js:60,142-148`**

**Impact:** A multi-branch branch_admin sees a single mixed pool of tables from every branch with no branch indicator (`GET /tables` with no `locationId` → `{ $in: all branches }`). The Navbar switcher is never consulted. Worse, "Add Table" hard-codes `locationId: user.assignedLocation?._id`, so a new table is always created in the primary assignedLocation regardless of intent — tables cannot be added to other managed branches from this screen.

**Evidence:** `tables/page.js:60` `api.get('/tables')` (no `locationId`/`selectedLocation`); `:146` `locationId: user.assignedLocation?._id`. `tableController.js:17-19` returns all branches when no `locationId` is sent.

**Fix:** Pass the selected branch to `GET /tables` and the addTable payload via `selectedLocation`, falling back to `assignedLocation` only for single-branch admins. Add a branch label per table card when managing >1 branch.

### `location-admin` Attendance roster silently omits chefs

**Severity: Medium | Category: Logic | Location: `client/app/dashboard/location-admin/attendance/page.js:37`**

**Impact:** The location-admin attendance page filters the user list to `u.role === 'staff'` only, so chefs assigned to that branch never appear and their attendance can never be marked from this screen. The branch-admin equivalent correctly includes chefs. Salary is computed from attendance, so a chef with no markable attendance gets inaccurate payable-days/salary.

**Evidence:** `location-admin/attendance/page.js:37` `setStaff(staffRes.data.data.filter(u => u.role === 'staff'))`; `branch-admin/attendance/page.js:37` uses `u.role === 'staff' || u.role === 'chef'`. Server `salaryVisibleRoles` returns `['staff','chef']` (`salaryController.js:38-43`).

**Fix:** Change the location-admin filter to `u.role === 'staff' || u.role === 'chef'`, matching the branch-admin page and the server-side visible-roles set.

### Chef BottomNav "Menu" tab points to `/dashboard/staff/menu` and is bounced by the layout guard

**Severity: Medium | Category: RBAC | Location: `client/app/components/BottomNav.js:38-44`; `client/app/dashboard/layout.js:39,116-128`**

**Impact:** On mobile/tablet the chef's bottom tab bar renders a "Menu" tab linking to `/dashboard/staff/menu`. Because `ROLE_PREFIX.chef = ['/dashboard/chef']` and that path is neither shared nor permission-granted, tapping it bounces straight back to `/dashboard/chef`. The chef has no working way to open the menu on mobile (the other three tabs work). Same root cause as the chef Sidebar finding, limited to one mobile tab.

**Evidence:** `BottomNav.js:38-44` chef candidates include `{ name: 'Menu', href: '/dashboard/staff/menu' }` ("Stats"/"Expenses" correctly use `/dashboard/chef/*`). `layout.js:39` `chef: ['/dashboard/chef'],`.

**Fix:** Add a chef-visible menu route under `/dashboard/chef`, or whitelist `/dashboard/staff/menu` for the chef role. Keep Sidebar and BottomNav consistent.

### Global ThemeContext number-input guard blocks `.`, `-`, `e` on ALL `type=number` inputs, including money fields

**Severity: Medium | Category: Logic | Location: `client/app/context/ThemeContext.js:41-72`; `client/app/components/reservations/ReservationForm.js:472-477,484-489`**

**Impact:** `ThemeContext` attaches a window-level keydown + paste handler that `preventDefault`s and toasts for `-`, `.`, `e`, `E` on any `input[type=number]` — app-wide. Decimals cannot be typed into ANY `type=number` field (verified 70 inputs across 28 files), including admin menu price/costPrice/originalPrice, expense/salary/gift-card amounts, and reservation Total/Advance. A barista cannot enter `149.50`; money is forced to whole rupees. Likely intentional ("Please enter a whole number") but it silently breaks legitimate paise/decimal entry everywhere.

**Evidence:** `ThemeContext.js:44-49` `forbiddenKeys = { '-':..., '.':'Please enter a whole number', 'e':..., 'E':... }`; `:51-57` `if (forbiddenKeys[e.key]) { e.preventDefault(); toast.error(...); }`; paste guard `:62-71` blocks `/[-.eE]/`. `ReservationForm.js:473,485` use `type="number"` for totalAmount/advancePayment.

**Fix:** Scope the whole-number lock to inputs that opt in (e.g. `data-whole-number` or `inputMode`), or allow `.` for currency fields. Do not enforce integer-only globally on every `type=number` input.

### `location_admin` is redirected to `/dashboard/branch-admin` (not `/dashboard/location-admin`) by login/root page

**Severity: Medium | Category: Logic | Location: `client/app/login/page.js:40` (and `client/app/page.js:15`)**

**Impact:** After login (when an already-authenticated user hits `/login`) or on root entry, a `location_admin` is pushed to `/dashboard/branch-admin` — a route the role cannot enter. The layout guard detects this and `router.replace()`s them to `/dashboard/location-admin`, so they eventually land correctly, but with a redirect flicker and a brief unauthorized branch-admin overview mount firing scoped API calls. The three role→route maps are inconsistent. (The primary form-login flow via `AuthContext.login` already uses `getRoleDashboard` correctly; only these two inline maps are buggy.)

**Evidence:** `login/page.js:40` `else if (user.role === 'branch_admin' || user.role === 'location_admin') router.push('/dashboard/branch-admin');`; `page.js:15` same. vs `AuthContext.js:71-81` `getRoleDashboard` `location_admin: '/dashboard/location-admin'`; `layout.js:40` `ROLE_PREFIX.location_admin` excludes `/dashboard/branch-admin`.

**Fix:** Replace the inline maps in `login/page.js:39-42` and `page.js:14-16` with `AuthContext.getRoleDashboard(user.role)` so all redirect logic uses one source of truth.

### `client/.env` sets `NEXT_PUBLIC_API_URI` but all code reads `NEXT_PUBLIC_API_URL` — env file silently ignored

**Severity: Medium | Category: Config | Location: `client/.env:1` (consumed at `client/app/services/api.js:20`, `client/app/services/socketUrl.js:10`)**

**Impact:** Same root cause as the API-base-URL finding above (logged separately by a second auditor). The only env file defines `NEXT_PUBLIC_API_URI`, but `resolveBaseURL()` and `getSocketUrl()` read `NEXT_PUBLIC_API_URL`, so the configured value is never picked up and both fall back to the hardcoded localhost default. Harmless in local dev; any deployment relying on this env file to repoint the client at a different API host (or `/api` same-origin proxy) silently breaks.

**Evidence:** `.env:1` `NEXT_PUBLIC_API_URI="http://localhost:5000/api"`; `api.js:20` and `socketUrl.js:10` read `NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'`. Grep confirms no code reads `NEXT_PUBLIC_API_URI`.

**Fix:** Rename the key to `NEXT_PUBLIC_API_URL` (or, for the documented prod proxy, set `NEXT_PUBLIC_API_URL=/api`). Pick one canonical name across env file and code.

---

## Low

### `connectDB()` rejection is unawaited/swallowed: on Mongo-down the server stays up, then DB requests hang ~5s and 500

**Severity: Low | Category: Crash | Location: `server/server.js:16`, `server/config/db.js:23-38`**

**Impact:** `server.js` calls `connectDB()` with no `await`/`.catch`. On `ECONNREFUSED` the rejection is only logged by the global `unhandledRejection` handler while `app.listen()` has already succeeded — the process reports "Server Live" and accepts connections, but every DB-touching request then eats a fresh 5s `serverSelectionTimeout` and 500s. Manifests only when Mongo is unreachable (the repo `.env` now points at local Mongo, so this exact mode was addressed at config level).

**Evidence:** `server.js:16` `connectDB();` (no await/catch). `db.js:33-38` catch nulls `connectionPromise` and rethrows → surfaces only to the global handler.

**Fix:** Add a readiness flag/middleware that returns 503 with a clear message while disconnected, or fail-fast for non-serverless deploys. (Prefer a 503 readiness gate over `process.exit(1)` to preserve the serverless lazy-connect path.)

### HTTP server has no `'error'` listener — a port clash (EADDRINUSE) crashes the process

**Severity: Low | Category: Crash | Location: `server/server.js:23-28`**

**Impact:** `app.listen()` returns a server with no `.on('error', ...)`. If the port is already taken (common in dev when an instance is "live"), Node throws an unhandled `'error'` event and the process dies with a raw stack trace instead of a friendly message.

**Evidence:** `server.js:23` `const server = app.listen(PORT, '0.0.0.0', () => {...})` with no `server.on('error', ...)`; observed `Error: listen EADDRINUSE: ... :5000`.

**Fix:** `server.on('error', (err) => { if (err.code === 'EADDRINUSE') { console.error(\`Port ${PORT} is already in use.\`); process.exit(1); } throw err; });`

### Socket.io Redis adapter force-enabled in production even without `REDIS_URL`, and has no `'error'` listener

**Severity: Low | Category: Config | Location: `server/config/socket.js:56-61`**

**Impact:** In any non-serverless production deploy, `NODE_ENV==='production'` alone enables the Redis adapter; with `REDIS_URL` unset it connects to `redis://127.0.0.1:6379`. With no local Redis, ioredis retries indefinitely and emits unhandled `'error'` events (log spam; cross-instance socket broadcasting silently fails). Confined to a production misconfiguration; not exercised locally (`NODE_ENV=development`).

**Evidence:** `socket.js:56` `if (process.env.REDIS_URL || process.env.NODE_ENV === 'production')` then `:57` `new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')` — no `pubClient.on('error', ...)` anywhere.

**Fix:** Enable the adapter only when `REDIS_URL` is set (drop `|| NODE_ENV==='production'`), always attach `.on('error', ...)` to pub/sub clients, and wrap adapter init in try/catch so a Redis outage degrades to in-memory.

### `ENCRYPTION_KEY` is defined twice in `server/.env` — fragile; precedence change could silently switch to a weak key

**Severity: Low | Category: Config | Location: `server/.env:1`, `server/.env:10`**

**Impact:** `ENCRYPTION_KEY` is set on line 1 (`akdjlasdf`, weak) and again on line 10 (strong). `encryption.js` scrypt-derives the AES key from this string and `decrypt()` fails soft (returns `''`), so a key flip causes silent PII (Aadhaar) loss, not a crash. With the installed dotenv (^17) the **first** definition wins, so the weak key may already be active. Locally `NODE_ENV=development` so `encryption.js` only warns; no data currently lost.

**Evidence:** `.env:1` `ENCRYPTION_KEY=akdjlasdf`; `.env:10` `ENCRYPTION_KEY=qyV3ch1z...`. `encryption.js:12` scrypt-derives the key; `:34-44` `decrypt()` returns `''` on error.

**Fix:** Delete the duplicate so there is exactly one definition, keeping the value that actually encrypted existing records (or stored Aadhaar ciphertext won't decrypt).

### `npm run seed:attendance` points at non-existent `./seed_attendance.js` (file lives in `seed/`)

**Severity: Low | Category: Config | Location: `server/package.json:12`**

**Impact:** `"seed:attendance": "node seed_attendance.js"` resolves relative to `server/`, but the file is at `server/seed/seed_attendance.js`, so the script fails immediately with `MODULE_NOT_FOUND`. Dev tooling only; does not affect the running app.

**Evidence:** `package.json:12` `"seed:attendance": "node seed_attendance.js"`; file exists only at `seed/seed_attendance.js`.

**Fix:** Change the script to `node seed/seed_attendance.js`.

### Blanket `checkPermissions('manageStaff')` overrides the per-route role-OR-permission gates on `/api/users`

**Severity: Low | Category: RBAC | Location: `server/routes/userRoutes.js:25,28,31-44`**

**Impact:** Every staff-management route is declared as `checkRoleOrPermission([...roles], 'manageStaff')` (intent: role OR permission), but line 25 applies `router.use(checkPermissions('manageStaff'))` first, requiring the permission for every non-super-admin regardless of role. If a super_admin revokes `manageStaff` from a role-authorized admin/branch_admin, they are fully locked out of staff management — the role half of the OR gate is dead for everyone except super_admin. Non-default and reversible.

**Evidence:** `userRoutes.js:25` `router.use(checkPermissions('manageStaff'));` then `:28` `.get(checkRoleOrPermission(['super_admin','admin','branch_admin','location_admin'], 'manageStaff'), getUsers)`. `checkPermissions` 403s before the downstream role gate runs.

**Fix:** Remove the blanket `router.use(...)` and rely on the per-route `checkRoleOrPermission` gates; or make the global guard `checkRoleOrPermission([...roles], 'manageStaff')` to preserve role-based access.

### Admin `updateUser` stores email without the `normalizeEmail`/validation used at signup/login — risks login lockout

**Severity: Low | Category: Logic | Location: `server/controllers/userController.js:305-316,395`; `server/middlewares/validateMiddleware.js:22,28`**

**Impact:** `loginSchema`/`signupSchema` both run `.normalizeEmail()`. The admin `PUT /api/users/:id` route has no `validate` middleware yet `email` is updatable. If an admin edits a user's email to a non-normalized form (e.g. `Rajesh.Charnwal@Gmail.com`), it is stored verbatim; subsequent login normalizes to `rajeshcharnwal@gmail.com` and `User.findOne` won't match — locking the user out. Requires an admin to enter a non-normalized email; reversible.

**Evidence:** `userController.js:306` `updatableFields` includes `'email'`; `:312-316` copies `req.body.email` verbatim. No setter/lowercase on the model (`User.js:11-19`); `findByIdAndUpdate` doesn't run save hooks. Login normalizes via `loginSchema` + `cleanEmail.toLowerCase()` (`authController.js:284-286`).

**Fix:** Normalize/validate email in `updateUser` the same way (lowercase + same `normalizeEmail` options) before `$set`, or add an email validation chain to the PUT route.

### `createOrderValidator` rejects paymentType `GIFT_CARD` although the model, `recordPayment` and redeem flow support it

**Severity: Low | Category: Logic | Location: `server/validators/orderValidator.js:29-32` vs `server/models/Order.js:152-156`, `server/controllers/orderController.js:352`**

**Impact:** The create-order body validator only accepts `['CASH','UPI','CARD','ONLINE','OTHER']`, so a client placing an order pre-tagged `GIFT_CARD` gets 400 "Invalid payment type" even though the schema enum, `recordPayment` and the redeem flow all use `GIFT_CARD`. In practice gift cards are applied post-create, so impact is limited — but it would break a POS that lets the cashier pick "Gift Card" at order entry.

**Evidence:** `orderValidator.js:29-32` `isIn(['CASH','UPI','CARD','ONLINE','OTHER'])`; `Order.js:154` enum includes `'GIFT_CARD'`; `orderController.js:352` allow-list includes `'GIFT_CARD'`.

**Fix:** Add `'GIFT_CARD'` to the `isIn` list so the validator matches the model enum and the `recordPayment` allow-list.

### Cancelling a SERVED order restores stock for food already delivered/consumed

**Severity: Low | Category: Logic | Location: `server/middlewares/omsMiddleware.js:13-14`; `server/services/orderService.js:679-698`**

**Impact:** `ALLOWED_TRANSITIONS` permits `SERVED → CANCELLED`. `cancelOrder` unconditionally calls `_restoreStockForItems`, which `$inc`s BranchStock/MenuItem stock back up. For an order already SERVED, the food was given to the customer, so re-crediting unit stock overstates on-hand inventory and can let phantom stock be re-sold. (Recipe items are correctly skipped; only unit-stocked/global items affected.)

**Evidence:** `omsMiddleware.js:13-14` `'READY': ['SERVED','CANCELLED'], 'SERVED': ['COMPLETED','CANCELLED']`. `orderService.js:683-684` `order.status = 'CANCELLED'; await this._restoreStockForItems(order);` — no prior-status guard.

**Fix:** Disallow `SERVED → CANCELLED` (require a refund/void path), or skip `_restoreStockForItems` when the order has reached READY/SERVED, restoring stock only for PLACED/ACCEPTED/PREPARING cancellations.

### Restock and PO receive overwrite `costPerUnit` instead of weighted-average

**Severity: Low | Category: Money | Location: `server/controllers/inventoryController.js:57-93`; `server/controllers/purchaseController.js:205-209`**

**Impact:** Both manual restock and PO receive set `costPerUnit` = latest purchase price, discarding the prior cost basis of stock on hand. However, `costPerUnit` is consumed only in a single CSV export column (`exportController.js:209`) — not in any P&L/COGS/valuation computation (COGS is booked from per-purchase `effectiveCost`; order profit uses `menuItem.costPrice`). So the real impact is a reporting-accuracy nuance in one export column, not P&L distortion.

**Evidence:** `inventoryController.js:61` `item.costPerUnit = Number(costPerUnit)`; `purchaseController.js:207` `$set: { costPerUnit: item.unitCost }` — neither blends an average.

**Fix:** Compute a weighted average on receipt: `newCost = (oldStock*oldCost + addedQty*purchasePrice)/(oldStock+addedQty)` and `$set` that.

### Staff availability toggle upserts a BranchStock row that is available with stock 0

**Severity: Low | Category: Logic | Location: `server/controllers/menuItemController.js:498-507`**

**Impact:** When a staff/chef toggles availability for an item with no BranchStock record yet, `findOneAndUpdate` with `upsert:true` and pipeline `{ isAvailable: { $not: '$isAvailable' } }` sets `isAvailable` true on insert (`$not null` → true) while `stock` stays at the schema default 0. The branch then advertises the item as available with 0 stock, so it appears orderable until order time rejects it — confusing UX, and it diverges from `updateStock` which couples `isAvailable` to `stock>0`.

**Evidence:** `menuItemController.js:498-502` `BranchStock.findOneAndUpdate({menuItem,branch}, [{ $set: { isAvailable: { $not: '$isAvailable' } } }], { new:true, upsert:true })` — no stock set.

**Fix:** Do not upsert on toggle (require an existing row), or on insert initialize `isAvailable: false` / couple it to `stock>0` as `updateStock` does.

### `discountedPrice` is validated against `originalPrice` but applied against `price` at order time

**Severity: Low | Category: Money | Location: `server/controllers/menuItemController.js:180-187,311-322`; `server/services/orderService.js:211-214`**

**Impact:** Create/update only reject `discountedPrice >= originalPrice` (and only when both present), but order pricing uses `base = (discountedPrice < price) ? discountedPrice : price`. An item can be saved with `originalPrice` unset (validation skipped) and a `discountedPrice` greater than `price`; at order time the discount is then not applied (customer charged `price` — no overcharge), so the configured discount silently does nothing. Latent pricing-logic inconsistency.

**Evidence:** `menuItemController.js:182-186` compares `discountedPrice >= originalPrice`; `orderService.js:211` compares against `price`, not `originalPrice`.

**Fix:** Pick one authoritative reference price — validate `discountedPrice < price` (the field used at order time), or make order pricing compare against `originalPrice` consistently with validation.

### `location_admin` default permissions omit `manageStaff`/`editRevenue`, breaking attendance/salary/expense pages

**Severity: Low | Category: RBAC | Location: `server/controllers/authController.js:192`; gates `server/routes/attendanceRoutes.js:24-28`, `server/routes/salaryRoutes.js:21-22`**

**Impact:** The attendance `/mark`,`/location` and salary `/location`,`/user/:id` routes role-allow `location_admin` but also require `checkPermissions('manageStaff')`, which the default set omits — so a default location_admin 403s on these. The attendanceController's location_admin lockdown branches can never be reached. **Practically dormant:** `location_admin` is not seeded anywhere and is not a selectable role in either creation UI, so on the as-shipped system there are no location_admin accounts to be affected and none can be created via the app.

**Evidence:** `authController.js:192` `location_admin: { ... manageStaff: false, editRevenue: false ... }`. `attendanceRoutes.js:25` and `salaryRoutes.js:22` wrap in `checkPermissions('manageStaff')`. No `location_admin` in `server/seed`; not offered in `staff/page.js:875-877` or `add-member/page.js:142-156`.

**Fix:** Either grant `location_admin` `manageStaff` by default, or drop the `manageStaff` gate on routes that already role-allow the role and rely on role + `enforceLocationAccess`. Keep the route role list and default permissions consistent.

### `seed_attendance` writes UTC-based dates while live clock-in uses IST — off-by-one "today" mismatch

**Severity: Low | Category: Logic | Location: `server/seed/seed_attendance.js:30` vs `server/controllers/attendanceController.js:295`, `client/app/dashboard/staff/attendance/page.js:84`**

**Impact:** `seed_attendance` derives the date via `toISOString().split('T')[0]` (UTC), while the live system computes the day in Asia/Kolkata. Near IST midnight (UTC+5:30) the UTC date is one day behind, so seeded "today" records can land on the previous IST day and the staff page's `todayRec` lookup misses them. Seed/demo data cosmetic skew only; real clock-ins are consistently IST.

**Evidence:** `seed_attendance.js:30` `date.toISOString().split('T')[0]`; `attendanceController.js:295` `istDateStr` via `toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})`; `staff/attendance/page.js:84` same IST formatting.

**Fix:** Use the same IST date formatting in the seed (`d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`).

### No overlap/duplicate guard on leave requests — multiple approved leaves can cover the same days

**Severity: Low | Category: Logic | Location: `server/controllers/leaveRequestController.js:22-62,120-136`**

**Impact:** A staff member can submit several overlapping leave requests, each independently approvable. Approval stamping is idempotent per Attendance `{user,date}` (so payroll is not double-counted), but it leaves redundant/contradictory LeaveRequest docs (e.g. approved "sick" and "casual" for the same date), making audit/leave-balance accounting unreliable. Data-hygiene gap, no money impact.

**Evidence:** `leaveRequestController.js:43` `LeaveRequest.create({...})` with no query for an existing overlapping pending/approved request; `:128-134` upsert per `{user,date}` keeps attendance idempotent.

**Fix:** Before creating, reject if an existing pending/approved request for the user overlaps `[fromDate,toDate]`; on approval, skip/flag days already stamped `'leave'` from another approved request.

### Reservation and table-booking overlap checks are read-then-write with no transaction (double-booking race)

**Severity: Low | Category: Logic | Location: `server/controllers/reservationController.js:178-216`; `server/controllers/tableController.js:146-169`**

**Impact:** `createReservation` does a `findOne` overlap check then `Reservation.create` with no session/transaction and no DB unique constraint. Two concurrent requests for the same table/slot can both pass and both create confirmed reservations, double-booking the table. `bookTable` has the same read-then-write shape on `isBooked`. Theoretical concurrency edge on a single-cafe deploy; worst case is one extra double-booking staff can cancel.

**Evidence:** `reservationController.js` `findOne(... tableIds: { $in })` then `Reservation.create({...})` with no `startSession`. Contrast `waitlistController.js:93-97` atomic `findOneAndUpdate` on `status:'waiting'`.

**Fix:** Wrap the overlap-check + create in a Mongoose transaction, or enforce at the DB layer with a partial unique index / atomic conditional insert.

### `createReservation` table overlap query uses raw `tableIds` instead of the normalized array (CastError → 500)

**Severity: Low | Category: Crash | Location: `server/controllers/reservationController.js:188-196`**

**Impact:** Line 169 normalizes to `selectedTableIds` (handles single string vs array) and is used correctly at `:170/204`, but the overlap check at `:193` uses the raw body `tableIds: { $in: tableIds }`. If a client posts `tableIds` as a single ObjectId string, `$in: '<string>'` is not an array and Mongoose throws a CastError → generic 500. The bundled client always sends an array, so only a third-party integration hits it.

**Evidence:** `reservationController.js:169` `const selectedTableIds = Array.isArray(tableIds) ? tableIds : [tableIds];` but `:193` uses un-normalized `tableIds`. `updateReservation` already uses `selectedTableIds` (`:402`).

**Fix:** Use `selectedTableIds` in the overlap query at `:193`: `tableIds: { $in: selectedTableIds }`.

### `updateBookingStatus` can 500 if the booking's location was deleted

**Severity: Low | Category: Crash | Location: `server/controllers/bookingController.js:272-277`**

**Impact:** When confirming a booking, the controller re-fetches the location with `Location.findById(booking.locationId)` and immediately reads `location.maxCapacity`. If the location no longer exists (deleted after the booking was made), `location` is null and `location.maxCapacity` throws a TypeError → unhandled 500. Rare deleted-location-mid-lifecycle condition; blocks confirming that one orphaned booking only.

**Evidence:** `bookingController.js:273-274` `const location = await Location.findById(booking.locationId); const maxCapacity = location.maxCapacity || 20;` with no null check. Contrast `getBookableLocation` (`:34-39`) which 404s on a missing location.

**Fix:** Guard the lookup (`if (!location) return res.status(404)...`), or add `maxCapacity` to the existing `.populate('locationId')` and reuse `booking.locationId?.maxCapacity || 20`.

### Concurrent gift-card redemptions on one order lose the `amountPaid` update

**Severity: Low | Category: Money | Location: `server/controllers/giftCardController.js:96,149-154`**

**Impact:** The order is loaded with `Order.findById`, then settled with a full-document `order.save()` that overwrites `amountPaid`/`paymentStatus`. The card debit is atomic, but the order write is not: two concurrent redemptions (two cashiers / double-click) read the same stale `amountPaid`, both debit their cards, and the second `save()` clobbers the first — two cards debited, order credited once. Order has no optimistic concurrency. Narrow concurrency race; drift bounded by the second redeem amount.

**Evidence:** `giftCardController.js:96` `Order.findById`; `:149` `newPaid = Number(order.amountPaid||0) + redeemValue`; `:154` `await order.save()` with no version/conditional guard.

**Fix:** Settle with an atomic guarded update: `Order.findOneAndUpdate({ _id, amountPaid: order.amountPaid }, { $inc: { amountPaid: redeemValue }, ... }, { new: true })`; if it matches nothing, compensate by re-crediting the card.

### Coupons have no per-customer usage cap

**Severity: Low | Category: Money | Location: `server/models/Coupon.js:34-41`; `server/services/orderService.js:233-244`**

**Impact:** The Coupon model tracks only a global `usedCount`/`usageLimit` — no per-customer redemption record. Order-time validation and `applyCoupon` enforce only the global limit. **Not a customer-facing exploit:** coupons cannot be self-applied — the public order endpoint ignores `couponId`, and all coupon endpoints require authenticated `manageOrders`/`manageCoupons`. So repeated reuse requires authenticated staff applying the coupon; it is a missing internal control, not an external promo-abuse vector.

**Evidence:** `Coupon.js:34-41` has `usageLimit`/`usedCount` only, no per-customer field. `orderService.js:233-244` checks only the global `$or` and `$inc:{usedCount:1}`. `publicController.createPublicOrder` does not accept `couponId`.

**Fix:** Add a per-customer cap (store redemptions keyed by `customerPhone`, or a `maxPerCustomer` field), and at finalization reject if the customer's prior count for the coupon reached the limit.

### Public feedback accepts an arbitrary/cross-branch `orderId` and has no per-order dedupe

**Severity: Low | Category: Logic | Location: `server/controllers/feedbackController.js:32-45`**

**Impact:** `submitFeedback` validates the `locationId` exists but stores `orderId` merely if it is a valid ObjectId — never verifying the order exists, belongs to that branch, or that the submitter is the customer. No per-order uniqueness. A submitter can attach any order's id and submit unlimited ratings (throttled to 5/min/IP), enabling review padding. (Branch attribution is driven by the separately-validated `locationId`, so the impact is incorrect order-linkage/review-padding, not falsified branch stats.)

**Evidence:** `feedbackController.js:34` `orderId: mongoose.isValidObjectId(orderId) ? orderId : null` — no `Order.findById`/ownership check. `models/Feedback.js` has no unique index on `orderId`. Public route with only a 5/min limiter (`feedbackRoutes.js:9-15`).

**Fix:** When `orderId` is provided, confirm `order.branch === locationId` (and ideally `customerPhone` matches) before storing; otherwise drop it. Add a partial unique index on `orderId` or reject a second submission per order.

### Seven analytics controllers are exported but never registered as routes (dead endpoints)

**Severity: Low | Category: Broken-API | Location: `server/routes/analyticsRoutes.js:27-54` vs `server/controllers/analyticsController.js:1017-1034`**

**Impact:** `getLocationAnalytics`, `getAllAnalytics`, `compareLocations`, `getTopLocations`, `getTrendingItems`, `getUnderperformingLocations`, `getProductPerformance` are exported and documented with `@route` comments but no route maps to them — any client hitting those paths would 404 (and a GET 404 is silently coerced to empty data). No current user impact: the client only calls the 9 registered routes.

**Evidence:** `analyticsRoutes.js` registers only `/advanced`, `/location-comparison`, `/staff-reports`, `/payment-intelligence`, `/branch-comparison-suite`, `/command-center`, `/forecasting`, `/location-intelligence/:id`, `/comparison-details`. Controller exports 16 functions. Client grep shows no calls to the unrouted paths.

**Fix:** Delete the unused controllers (and `@route` comments), or register the intended routes with the existing `viewAnalytics` gating.

### Advanced-analytics payment-method and source breakdowns count pending/rejected transactions (omit `status:'approved'`)

**Severity: Low | Category: Logic | Location: `server/services/analyticsService.js:231-247`**

**Impact:** The UPI/CASH method split (`upiStats`) and source breakdown (`paymentAgg`) filter only on `type: {$ne:'EXPENSE'}` and omit `status:'approved'`, while the revenue time-series (`:165`) and totals do filter on approved. So the payment-mix chart includes pending/rejected POS revenue excluded from the revenue figures shown alongside it — inconsistent percentages vs the headline revenue (headline totals are unaffected).

**Evidence:** `paymentAgg`/`upiStats` `$match: { ...transactionMatch, type: { $ne: 'EXPENSE' } }` (no status); `transactionAgg` (`:165`) adds `status: 'approved'`.

**Fix:** Add `status: 'approved'` to the `$match` of both `upiStats` and `paymentAgg` so the breakdowns use the same approved set as the time-series.

### Attendance aggregation in `getAdvancedAnalytics` inherits a `createdBy` filter, zeroing attendance when `adminId` is set

**Severity: Low | Category: Logic | Location: `server/services/analyticsService.js:137-147,218-230`**

**Impact:** When filtered by `adminId`, `match.createdBy` is set and spread into the Attendance aggregation's `$match`. The Attendance collection has no `createdBy` field, so the attendance trend chart returns zero rows when an admin filter is applied. **Latent:** the shipped admin dashboard never sends `adminId` (only `locationIds`/dates), so this is reachable only via a hand-crafted request.

**Evidence:** `analyticsService.js:141` `match.createdBy = new mongoose.Types.ObjectId(adminId)`; `:219` Attendance `$match` spreads `...match`. `models/Attendance.js` has no `createdBy` field.

**Fix:** Build the Attendance `$match` from only supported fields (locationId + date): `const attendanceMatch = {}; if (match.locationId) attendanceMatch.locationId = match.locationId;` and use that instead of spreading the full `match`.

### Cash-drawer open/close and settings updates write no AuditLog entry

**Severity: Low | Category: Other | Location: `server/controllers/cashDrawerController.js:62-177`; `server/controllers/settingsController.js:33-87`**

**Impact:** Financially sensitive actions — opening a register float, closing a drawer (variance), pay-in/pay-out, and money-affecting settings changes (GST rate, service charge, payroll/loyalty rules) — are not recorded via `logActivity`, unlike cafe/location actions. No central audit trail for who changed the GST/service-charge rate. (The CashSession doc does persist `openedBy`/`closedBy`/variance, so drawer actions are attributable on the doc; only settings changes lack any attribution record.)

**Evidence:** `cashDrawerController` open/close/addMovement contain no `logActivity`; `settingsController.updateSettings` persists via `Settings.findOneAndUpdate` with no `logActivity`. Contrast `cafeController`/`locationController` which call `logActivity`.

**Fix:** Add `logActivity` calls: `CASH_DRAWER_OPEN`/`CASH_DRAWER_CLOSE` (with variance) and `SETTINGS_UPDATE` (with changed groups) so money-affecting changes are attributable.

### Impersonate page "Back to My Account" button and security label read `user.isImpersonating` which the server never sets

**Severity: Low | Category: UI-Broken | Location: `client/app/dashboard/admin/impersonate/page.js:166,183,190,200-210`**

**Impact:** While impersonating, this page never shows its own "Back to My Account" button and always displays the wrong security label/badge (e.g. "Role: Super Admin" instead of "Logged in as another user"), because it keys off `user.isImpersonating` — a property the server never returns (the server uses `user.impersonatedBy`). Users are not stranded: the global dashboard banner correctly uses `impersonatedBy` and offers a working "Exit Session" button. Degraded/misleading UI only.

**Evidence:** `page.js:166` `if (user?.isImpersonating) return 'Logged in as another user';`; `:200` button rendered only `{user?.isImpersonating && (...)}`. Grep shows `isImpersonating` never set server-side; `authController.js:449-450` sets `userData.impersonatedBy`.

**Fix:** Replace every `user?.isImpersonating` on this page with `user?.impersonatedBy`.

### "Print Order" button in order details modal has no `onClick` handler (does nothing)

**Severity: Low | Category: UI-Broken | Location: `client/app/dashboard/admin/orders/components/OrderDetailsModal.js:233-235`**

**Impact:** The "Print Order" button at the bottom of every order details dossier (printer icon, hover style) has no `onClick`, so clicking it is a silent no-op. A real generate-bill endpoint (`POST /api/orders/:id/generate-bill`) exists but is never invoked from here.

**Evidence:** `OrderDetailsModal.js:233` `<button className="..."><Printer size={14} /> Print Order </button>` — no `onClick`; no `handlePrint` in props. Every other action button in the file has an `onClick`.

**Fix:** Wire the button to a print/bill handler (call `/orders/:id/generate-bill` and print the returned bill, or `window.print()` a formatted receipt), or remove it.

### Order Analytics "Download Report" button (chef leaderboard) has no `onClick`

**Severity: Low | Category: UI-Broken | Location: `client/app/dashboard/admin/orders/analytics/page.js:706-708`**

**Impact:** The Kitchen Leaderboard header renders a prominent "Download Report" button (Download icon) with no `onClick` — clicking does nothing. Chef-performance export is actually available via the `ExportActions` component at the top of the page (`:191-195`), so this redundant button just dead-ends.

**Evidence:** Lines 706-708: `<button className="h-14 px-10 bg-primary ..."><Download size={18} strokeWidth={3} /> Download Report</button>` — no `onClick`. Working export: `<ExportActions data={data?.charts?.chefPerformance ...} columns={chefColumns} filename="Chef_Performance_Report" />` at `:191`.

**Fix:** Remove the decorative button, or wire it to the same export path used by the `chefPerformance` `ExportActions`.

### Stray Python dev utility `check_balance.py` shipped inside a Next.js route folder

**Severity: Low | Category: Other | Location: `client/app/dashboard/admin/orders/analytics/check_balance.py`**

**Impact:** A brace/paren-balance-checking Python script sits next to `page.js` inside the App Router route directory. It is dead weight unrelated to the route, ships in the repo, and is a leftover debugging artifact. Next.js does not execute it, so it is not a runtime bug.

**Evidence:** File contents: a `check_balance(filename)` function counting `{}`/`()`/`[]`, invoked via `if __name__ == "__main__": check_balance(sys.argv[1])`. Confirmed present (793 bytes) beside `page.js`.

**Fix:** Delete the file (or move it to a `/scripts`/`/tools` dir outside `client/app`). Add a lint/CI guard against non-source files under route directories.

### `location-admin` Tables bill total derives from the staged cart, diverging from branch-admin (kitchen orders)

**Severity: Low | Category: Money | Location: `client/app/dashboard/location-admin/tables/page.js:232-248,553-580`; `client/app/dashboard/branch-admin/tables/page.js:286-317,786-833`**

**Impact:** The two Tables variants implement different billing flows. branch-admin posts items to `/orders` (kitchen) and computes the on-screen total from real Order docs, only allowing "Finish & Bill" once all kitchen orders are SERVED/COMPLETED. location-admin has no "Send to Kitchen" path: it computes the displayed total purely from the local staged cart and goes straight to "Print Bill & Checkout". On the same table the two roles can show different totals, and a location_admin can bill items never sent to the kitchen. **No money is lost or miscalculated:** the server `uploadBill` reconciles the staged cart into a real COMPLETED order with the same total, so the displayed total IS what gets billed — a process/consistency divergence, not a money-math error.

**Evidence:** `location-admin/tables/page.js:553` Subtotal = `pendingOrders.reduce(...)`, `:576` opens bill preview with no kitchen step. `branch-admin/tables/page.js:790` Subtotal = `systemOrders.reduce(...)`, "Finish & Bill" (`:823-827`) blocks unless all SERVED/COMPLETED. Server reconciliation `tableController.js:418-456`.

**Fix:** Align the flows: give location-admin the same kitchen-order pipeline, or explicitly document it as a "quick bill" counter and base the displayed total on the server-synced `table.totalAmount`.

### `location-admin` Staff "Add Staff" links to `/dashboard/add-member`, which the role cannot complete

**Severity: Low | Category: UI-Broken | Location: `client/app/dashboard/location-admin/staff/page.js:109-117`**

**Impact:** The location-admin Staff page's "Add Staff" button links to `/dashboard/add-member` (a reachable SHARED_PREFIX), but `POST /auth/register` is blocked for `location_admin` by a **hard role gate** (`gateCanCreateUser` allows only super_admin/admin/branch_admin) regardless of any granted permission. So the button navigates to a member-creation form the role can never submit — an inconsistent dead-end vs branch-admin/staff which opens an in-page create modal.

**Evidence:** `location-admin/staff/page.js:109` `<Link href="/dashboard/add-member">`. `Sidebar.js:144-146` hides "Add Member" for location_admin. `authRoutes.js:33-40` `gateCanCreateUser` 403s every location_admin. Contrast `branch-admin/staff/page.js:95-121`.

**Fix:** Hide "Add Staff" for `location_admin` (consistent with the Sidebar hiding "Add Member"), or only render it when the role can actually complete `/auth/register`.

### Per-item "mark ready" fast-path promotes orders to READY without setting `assignedChef`, undercounting chef stats

**Severity: Low | Category: Logic | Location: `server/controllers/orderController.js:537-583` vs `server/services/orderService.js:372-375`**

**Impact:** The chef item check-buttons (`PATCH /orders/:id/item-status`) auto-promote an order to READY when all items are toggled ready, but `updateItemStatus` never sets `assignedChef` (unlike the ACCEPTED transition in `updateStatus`). A chef who works a ticket purely via item check-buttons leaves `assignedChef` null, so `getMyChefStats` (which queries `{ assignedChef: userId }`) and chef analytics never credit those orders. Chef performance dashboards under-report. (Partially mitigated: the PLACED lane shows an "Accept Order" primary action that does set `assignedChef`.)

**Evidence:** `updateItemStatus` sets `order.status = 'READY'` with no `assignedChef` assignment; `updateStatus` does `if (status === 'ACCEPTED' && userRole === 'chef') { order.assignedChef = userId; }`. `getMyChefStats` queries `{ assignedChef: userId }` (`orderController.js:993`).

**Fix:** In `updateItemStatus`, when `req.user.role === 'chef'` and `assignedChef` is unset, set `order.assignedChef = req.user._id` before `save()` (at least when the first item moves to preparing/ready).

### Item-status toggle can jump PLACED straight to READY, bypassing the OMS lifecycle

**Severity: Low | Category: Logic | Location: `server/controllers/orderController.js:566-573`; `client/app/dashboard/chef/page.js:333-341`**

**Impact:** The chef item check-buttons render in the PLACED ("New Orders") lane (`canToggle` excludes only COMPLETED/CANCELLED/REJECTED). Toggling all items ready on a PLACED order drives it PLACED → READY in one step, skipping ACCEPTED and PREPARING. This route is not behind `validateOrderTransition`, so it sidesteps the strict lifecycle. Result: prep-time analytics that key off ACCEPTED→READY timestamps get no `acceptedAt` and silently exclude these orders; no `assignedChef` is recorded. Analytics/consistency edge case (overlaps the chef-attribution finding); the order still reaches READY and is servable.

**Evidence:** `chef/page.js:324` `canToggle = !['COMPLETED','CANCELLED','REJECTED'].includes(order.status)`. `orderController.js:566-569` `if (allDone && ['PLACED','ACCEPTED','PREPARING'].includes(order.status)) { order.status='READY'; }`. `orderRoutes.js:67` (`item-status`) has no `validateOrderTransition`, unlike `/accept`,`/start`,`/ready`.

**Fix:** Hide/disable the per-item ready toggle until the order is at least ACCEPTED, or have `updateItemStatus` push intermediate ACCEPTED (with `assignedChef`) and PREPARING history when promoting from PLACED.

### CommandPalette quick-nav exposes admin-only routes to every role; non-admins get bounced

**Severity: Low | Category: RBAC | Location: `client/app/components/ui/CommandPalette.js:174-196,100-109`; `client/app/dashboard/layout.js:188`**

**Impact:** CommandPalette renders for all roles (Cmd/Ctrl+K). Its empty-search "Quick Navigation" always offers "Staff List" → `/dashboard/admin/users`, "Dashboard" → `/dashboard/admin`, "Expenses" → `/dashboard/admin/expenses` regardless of role. A staff/chef selecting any of these is routed into `/dashboard/admin/*` and immediately bounced by the layout guard. Nothing leaks (the guard bounces safely); purely non-functional shortcuts in an opt-in palette.

**Evidence:** `CommandPalette.js:178-182` hardcodes the three admin-pathed nav items with no role filter; `handleSelect` (`:100-102`) `router.push(item.path)`. `layout.js:188` `<CommandPalette />` for every authenticated user.

**Fix:** Derive quick-nav targets from the user's role (reuse `getRoleBasePath`/Sidebar group logic), or gate the palette's nav section to admin/super_admin.

### `client/.env` sets `NEXT_PUBLIC_API_URI` but code reads `NEXT_PUBLIC_API_URL` (corroboration of known config bug)

**Severity: Low | Category: Config | Location: `client/.env:1`; `client/app/services/api.js:20`; `client/app/services/socketUrl.js:10`**

**Impact:** Third logged instance of the same pre-identified config bug (included for corroboration). `client/.env` defines `NEXT_PUBLIC_API_URI` but both `api.js` and `socketUrl.js` read `NEXT_PUBLIC_API_URL`, so the `.env` value is ignored and both fall back to the localhost default. Harmless in local dev; any non-default deployment relying on the env file silently targets localhost.

**Evidence:** `.env:1` `NEXT_PUBLIC_API_URI="http://localhost:5000/api"`; `api.js:20`/`socketUrl.js:10` read `NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'`.

**Fix:** Rename the env var to `NEXT_PUBLIC_API_URL` (or change both code reads). Keep one canonical name across `.env` and code.

### Delegated `viewAnalytics` surfaces "Staff Reports" to staff/chef, but the API role-gates them out (403)

**Severity: Low | Category: RBAC | Location: `client/app/components/Sidebar.js:43,282-287`; `server/routes/analyticsRoutes.js:35-36`**

**Impact:** `GRANTABLE_PAGES` surfaces "Staff Reports" (→ `/dashboard/admin/staff-reports`) under a "Granted Access" group to any non-default role holding `viewAnalytics` (which can include staff/chef). The page calls `GET /analytics/staff-reports`, which passes the router-level `viewAnalytics` check but then hits route-level `checkRoles('branch_admin','location_admin','admin','super_admin')` and 403s for staff/chef. The granted link opens a page that fails to load data. Only reachable if an admin explicitly grants `viewAnalytics` to a staff/chef account.

**Evidence:** `Sidebar.js:43` Staff Reports `perms: ['viewAnalytics']`, `defaultRoles` excludes staff/chef; `:282-287` surfaces it for any role holding the perm. `analyticsRoutes.js:25` `router.use(checkPermissions('viewAnalytics'))`; `:35-36` adds `checkRoles(...)` excluding staff/chef — contradicting the comment at `:30-31`.

**Fix:** Drop the extra `checkRoles` on `/analytics/staff-reports` so `viewAnalytics` alone governs it (matching the route comment), or remove role-gated analytics pages from `GRANTABLE_PAGES`.

### Invalid `/order` branch link renders an empty menu silently instead of an error

**Severity: Low | Category: Broken-API | Location: `client/app/order/page.js:27-33` (interaction with `client/app/services/api.js:77-79`)**

**Impact:** When `/order` is opened with a syntactically valid but stale/deleted `branchId`, the server returns 404 "Branch not found". The axios interceptor converts any GET 404 into a resolved `{success:true, data:null}`, so the `.catch(setError)` never runs — the page renders `branchName=''` and `items=[]`, showing a working-looking "Order" screen with "No items available right now." A dead link and a genuinely empty menu are indistinguishable. (A malformed `branchId` returns 400, which is not swallowed and correctly shows the error — so this only affects valid-but-nonexistent ObjectIds, e.g. a deleted branch.)

**Evidence:** `order/page.js:29-32` `api.get('/public/menu?branchId='+branch).then(...).catch(() => setError(...))`; `api.js:77-79` `if (status === 404 && error.config?.method === 'get') return Promise.resolve({ data: { success: true, data: null } });`. `publicController.js:15-25` returns 400 for invalid ObjectId, 404 for valid-but-missing.

**Fix:** After the GET, treat a null/absent branch as an error: `if (!r.data?.data?.branch) { setError('Could not load the menu. Please check the link.'); return; }`. Same pattern affects any public GET that 404s on a bad identifier.

---

## Broken / Mismatched APIs

| Client call | Expected server route | Problem |
|---|---|---|
| `GET /orders?branchId=<id>` (chef KDS, `chef/page.js:56`) | `getOrders` (`orderController.js:130-145`) | No limit/status filter → server returns only 20 newest of all statuses; active tickets beyond the window silently vanish from every lane (**High**) |
| `POST /auth/impersonate/:userId` (admin "Login As", `impersonate/page.js`) | `authRoutes.js:46` gated `['super_admin'] OR impersonateUsers` | Page shows the button to default admins who lack the permission → every click 403s (**High**) |
| `PUT /settings` (location_admin Save, `settings/page.js:116`) | `settingsRoutes.js:11` `checkRoles('super_admin','admin','branch_admin')` | `location_admin` omitted from gate → every Save 403s despite the controller being willing to authorize them (**High**) |
| `GET /transactions` (seeded branch_admin Revenue/Expenses) | `transactionRoutes.js:15-17` gated `viewRevenue`/`editRevenue` | Seed omits revenue perms → 403 error state on Revenue/Expenses screens (**Medium**) |
| `GET /salary/location`, `/attendance/location`, `/attendance/mark`, `/users/*` (default location_admin) | gated `checkPermissions('manageStaff')` | Default `location_admin` lacks `manageStaff` → 403 / error state on Salary/Attendance/Staff pages (reachable by direct URL) (**Medium**) |
| `PATCH /orders/:id/items` (no live client caller) | `updateOrderItems` → `OrderService.updateItems` | Unconditional transaction, no standalone-Mongo fallback → 500 on standalone MongoDB (latent) (**Medium**) |
| `GET /public/menu?branchId=<stale id>` (`order/page.js:29`) | `getPublicMenu` (404 on valid-but-missing branch) | Interceptor swallows GET 404 → silent empty menu instead of "check the link" error (**Low**) |
| `GET /analytics/staff-reports` (delegated staff/chef via granted link) | `analyticsRoutes.js:35-36` adds `checkRoles(...)` excluding staff/chef | Granted link opens a page that 403s loading data (**Low**) |
| `POST /orders` with `paymentType: 'GIFT_CARD'` | `createOrderValidator` `isIn([...no GIFT_CARD])` | 400 "Invalid payment type" though model/`recordPayment`/redeem all support GIFT_CARD (**Low**) |
| `GET /analytics/all`, `/trending-items`, `/product-performance/:id`, etc. (no client caller) | controllers exported but **no route registered** | 7 dead endpoints → 404 if ever called (**Low**) |
| `createReservation` with `tableIds` as a single string (non-bundled client) | `reservationController.js:193` `$in: tableIds` (un-normalized) | CastError → generic 500 (**Low**) |

## Broken Buttons & Dead Links

| Button / Link | Location | Problem |
|---|---|---|
| Chef Sidebar "Branch Menu", "My Performance", "Work History", "My Attendance" | `Sidebar.js:220,259-263` | Point at `/dashboard/staff/*`; layout guard bounces chef back to Kitchen (**High**) |
| Chef BottomNav "Menu" tab | `BottomNav.js:38-44` | Points at `/dashboard/staff/menu`; bounced back to Kitchen on mobile (**Medium**) |
| Expense detail "Download Receipt" | `expenses/page.js:708-714` | No `onClick` — silent no-op (**Medium**) |
| location-admin Staff "Add Staff" | `location-admin/staff/page.js:109` | Links to `/dashboard/add-member`; `/auth/register` hard-blocks `location_admin` (**Low**) |
| Impersonate "Back to My Account" button + security label | `impersonate/page.js:166,200` | Keys off `user.isImpersonating` (never set by server) → button never shows, label wrong (**Low**) |
| Order details "Print Order" | `OrderDetailsModal.js:233-235` | No `onClick` — silent no-op (a real generate-bill endpoint exists) (**Low**) |
| Order Analytics "Download Report" (chef leaderboard) | `orders/analytics/page.js:706-708` | No `onClick` — redundant dead button (working export is the page's `ExportActions`) (**Low**) |
| CommandPalette "Staff List" / "Dashboard" / "Expenses" quick-nav | `CommandPalette.js:178-182` | Admin-pathed for every role; non-admins are bounced by the layout guard (**Low**) |
| Login/root redirect for `location_admin` | `login/page.js:40`, `page.js:15` | Pushes to `/dashboard/branch-admin` (forbidden) → flicker + brief unauthorized mount before bounce (**Medium**) |

## Notes & Refuted Items

The following item was investigated and determined **not** to be a bug, so it is excluded from the findings above:

- **"Waste records deduct stock but never book the cost as a loss/expense"** (`server/controllers/inventoryController.js:100-132`). The factual observation is correct — `logWaste` creates only a `WasteRecord` and books no Expense, while restock/PO-receive book Inventory expenses. **But the monetary-loss impact does not hold under this system's accounting model.** Inventory cost is expensed at **purchase/restock time** as a full "Inventory" category Expense (the entire restock/PO amount, not per-unit-sold COGS). The cost of any ingredient later wasted was therefore *already* recorded in P&L when bought; booking a separate waste expense would **double-count** it and *understate* profit. Order-level profit uses `menuItem.costPrice` (a separate menu-level cost line), unaffected by waste either way. So there is no P&L overstatement — the only gap is a distinct *reporting line* that surfaces waste cost separately, a feature request, not a money bug.

Additional clarifications confirmed during verification (so the report's scope is trustworthy):

- The `NEXT_PUBLIC_API_URI` vs `NEXT_PUBLIC_API_URL` typo is **harmless on the current local deployment** (the hardcoded fallback equals the intended value); it only bites non-default/remote deployments. It is logged three times (one Medium, two Low) because three independent auditors found it; it is the single pre-known config bug.
- Several RBAC findings (location_admin Salary/Attendance/Staff 403s, the location_admin default-perms gap, the CommandPalette quick-nav) are **only reachable by direct URL or an opt-in palette**, not by clicking a visible link in normal navigation — the Sidebar correctly hides those links for the affected roles. They are real but lower-impact than a discoverable dead button.
- `location_admin` is **not seeded and not creatable via the UI** on the as-shipped system, so location_admin-specific findings are real code defects but largely dormant in practice today.
- Money figures shown in the **live in-app analytics** (revenue page totals, dashboard) are computed from approved transactions and are correct; the always-₹0 bug is confined to the **scheduled daily email report**, and the GST/service-charge inflation is in the **revenue Transaction amount** vs the documented model intent — both real, but the live analytics totals are otherwise self-consistent.