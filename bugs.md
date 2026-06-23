# CafeOS — Bugs, Vulnerabilities & Gaps

_Resolved items are **removed** from this file as they're fixed (see git log for the history). What remains below is the still-open work: operational actions, design decisions, and audits in progress._

_Last updated: 2026-06-22._

---

## 🔄 Pass 3 — A-to-Z inspection (in progress)

A full-stack senior-inspector pass is running across all 14 feature areas (auth, users, orders, menu, tables/reservations, money, payroll, analytics, inventory, notifications/realtime, locations/customers, super-admin, + cross-cutting data-correctness and frontend-UX). Each endpoint/page/flow is traced end-to-end and every finding is adversarially verified against the already-patched code. **Confirmed new findings will be written here** (by severity) as they land; CRITICAL/HIGH/MEDIUM will then be fixed and removed.

### Pass 3 findings

The 14-area inspector surfaced **55 findings** (mostly business-logic / financial / data-integrity bugs that the security-focused passes 1–2 didn't target). Verification is in progress; a few may turn out to be false positives. **7 fixed already**, the rest are open below by severity.

**✅ Fixed so far (pass 3):** removed the production "Quick Login" panel (hardcoded creds + one-click Super-Admin sign-in); hid menu `costPrice` from staff/chef and required branch ownership to edit a menu item; `updateUserPermissions` validates+merges (partial body can't wipe perms); `finalizeOrder` claims the order atomically (no duplicate REVENUE on concurrent /complete); impersonation re-checks the impersonator each request; clamped `getNotifications` pagination.

**🔴 Open findings (being verified & fixed):**
**CRITICAL**
- Export leaks ALL branches' data to a location_admin (missing role in branch-scoping) — `exportController.js:40-51`

**HIGH**
- Global 401 interceptor bounces logged-out visitors off /signup, breaking public onboarding / first-run super-admin setup — `api.js:18-23`
- updateItems mutates BranchStock outside any transaction and with no input validation — `orderService.js:331-412`
- Reservation advance/full payment booked into the ledger as a NEGATIVE expense, corrupting revenue & P&L — `transactionService.js:79-93; reservationController.js:194-208`
- Staff/admin can self-approve arbitrary reservation income into the ledger (bypasses expense approval) — `reservationController.js:194-209`
- Table 'complete' wipes the table while live kitchen orders stay active → lost revenue + orphaned orders — `tableController.js:297-322`
- Reservation income booked into the ledger as an EXPENSE, corrupting revenue/profit — `transactionService.js:84-91`
- expenseId silently dropped by createTransaction, so expense→ledger sync duplicates instead of updating — `transactionService.js:9-93`
- Revenue pages display approved EXPENSE rows as positive revenue (type filter case mismatch) — `admin/revenue/page.js:105; branch-admin/revenue/page.js:54`
- Absent days deducted twice in payroll netSalary (double penalty) — `salaryController.js:294-304`
- Super-admin payroll approval skips stages and is re-runnable (no idempotency) — `salaryController.js:348-351`
- comparison-details endpoint crashes (ReferenceError: getDateMatchCriteria is not defined) — `analyticsController.js:290`
- Recipe ingredient deduction drives BranchInventory.stock negative on order completion — `inventoryService.js:31-34`
- "Record Waste" broken: expiry/damage reasons rejected by model enum — `admin/inventory/page.js:584-585`
- updateInventory persists stock = NaN for non-numeric quantity — `inventoryController.js:36-48`

**MEDIUM**
- Editing a user's name 403s + partial save when their existing permissions exceed the editor's grantable set — `users/page.js:207-216`
- uploadBill finalizes (bills + deducts inventory for) orders that were never prepared — `tableController.js:227-240`
- Reservation overlap checks have no startTime<endTime validation; inverted ranges bypass conflict detection — `reservationController.js:20-22,116-191`
- Public createBooking lets anyone exhaust a location's capacity (no auth/rate-limit) — `bookingRoutes.js:15; bookingController.js:61-95`
- Expense submit UI posts to /transactions, bypassing the mandatory receipt/proof image — `{admin,branch-admin,location-admin,staff}/expenses/page.js`
- GET /api/expenses has no permission/role gate — staff/chef can read branch financials — `expenseRoutes.js:10-11`
- Manual EXPENSE via /transactions co-exists with the Expense/sync ledger → double counting — `transactionController.js:137-187`
- Attendance status enum not enforced (findOneAndUpdate without runValidators) — `attendanceController.js:61-71`
- Admin can view salaries of peer/superior admins via role query override — `salaryController.js:118-127`
- Revenue export includes EXPENSE rows + pending/rejected txns, mislabeled as revenue — `exportController.js:91-102`
- Revenue/orders export filters by createdAt while analytics use the business `date` field — `exportController.js:53-68`
- Branch Comparison 'FY' period hard-coded to FY2025-26 (stale) — `analyticsController.js:738-742`
- manageOrders staff can list inventory but 403 when a branch is selected (route gate mismatch) — `inventoryRoutes.js:25`
- createIngredient mass-assigns req.body with no validation — `inventoryController.js:147`

**LOW**
- Signup password rule mismatch: frontend accepts 6 chars, backend rejects under 10 — `signup/page.js:24`
- Login uses a unique 429 for locked accounts, enabling account enumeration — `authController.js:278-281`
- getPresets returns every permission preset globally (no scoping) — `permissionPresetController.js:36-39`
- getUsers exposes monthlySalary/aadharImage/permission matrix to any manageStaff holder — `userController.js:156-165`
- demoteUser no-op on staff/chef but emits a misleading 'demoted' notification — `userController.js:264-283`
- generate-bill not idempotent + never sets isBilled (repeat billing / history spam) — `orderController.js:266-314`
- Order item quantity has no upper bound on create — `orderValidator.js:17-21`
- getOrders status filter not validated against the enum — `orderController.js:59-62`
- Stock update bypasses min:0 validator → negative/NaN stock — `menuItemController.js:480-500`
- Recipe read endpoint has no access control / branch scoping — `recipeController.js:8-20`
- deleteCategory soft-deletes only; items keep a dead category ref — `categoryController.js:107-122`
- bookTable/updateOrders accept numberOfPeople with no capacity/sign validation — `tableController.js:117-159`
- rejectTransaction lacks the creator self-action block that approveTransaction has — `transactionController.js:290-317`
- Month param never format-validated; malformed month → NaN day count — `salaryController.js:10-13`
- Monthly summary counts attendance for all roles but staff for headcount/salary — `attendanceController.js:189-247`
- getAllSalary limit param unbounded (no clampLimit) — `salaryController.js:146-147`
- comparison-details attendance window ignores endDate / different baseline than sales — `analyticsController.js:322-330`
- getPurchaseSuggestions dereferences item.ingredient.name without null guard — `inventoryController.js:135`
- updateInventory can't set costPerUnit/minThreshold to 0 (falsy bug) — `inventoryController.js:45-46`

> Sanity-check note: also verified clean — notification mark-read/unread (user-scoped, no IDOR), file uploads (5 MB + type filter), all list endpoints clamp their limit except those noted, all mutation routes role/permission-gated, `api.js` 401 handling.

---

## ⚠️ Operational action items — only you can do these (before next deploy)

_Done for you locally:_ a **fresh strong `JWT_SECRET` and `ENCRYPTION_KEY` are now in `server/.env`** (gitignored), `server/.env.example` documents every required var, and the old `.env` is untracked. Remaining steps need your dashboards / host:

1. **Rotate the leaked secrets** (they're still in git **history**, commit `cfad6ae:server/.env`). On the dashboards: rotate the **MongoDB Atlas** DB-user password (stop using `demo`) and regenerate the **Cloudinary** API secret. Then set on your **backend host** env: the new `JWT_SECRET` + `ENCRYPTION_KEY` (from `server/.env`), the new `MONGO_URI` (with the rotated password) and the new Cloudinary secret. Finally purge the file from history (`git filter-repo --path server/.env --invert-paths` or BFG) and force-push — _say the word and I'll run the history purge for you._
2. **Set `ENCRYPTION_KEY` on the host** to the **same value** that's now in `server/.env` (local and host share the Atlas DB, so the key must match). The backend **fails closed in production** without it. Keep it constant.

---

## 🧭 Kept by design (decided)

- **`getUser` shows the FULL decrypted Aadhaar (all 12 digits) to a managing admin** (`userController.js`). Confirmed desired — Aadhaar is visible in the staff detail view, no masking.

---

## ⬜ Remaining open — low priority (deep pass 2)

Both deep audits (security pass 2 + UI/flow/feature) completed. **Every confirmed CRITICAL, HIGH and MEDIUM finding has been fixed and removed from this list** (see git log). The few that remain are low-impact:

- **Long-lived JWT/cookie (30d, `sameSite=none`)** — widens the token-theft / CSRF window. Already mitigated by the new CSRF guard + logout revocation; lower `JWT_EXPIRE` if you want tighter sessions. _(config)_
- **PDF uploads served inline** via raw Cloudinary URLs (no `fl_attachment`) — a PDF opens in-browser instead of downloading. _(`uploadMiddleware.js`)_
- **/register runs the Cloudinary upload before the role gate** — an authenticated low-priv user could trigger an upload before being rejected (bounded by the auth rate limiter). _(`authRoutes.js`)_

---

## ✅ Resolved this session (summary — details in git log)

All **34** pass-1 security findings are now either fixed or covered by the operational/by-design items above, and the **16-permission RBAC** review is resolved (every granted permission now works end-to-end; `exportReports`/`manageCoupons`/`forceComplete` made permission-driven; sidebar/page-access completed). Notable pass-1 fixes: register privilege-escalation, password/Aadhaar response leaks, destructive password-reset migration removed, regex-injection hardening, session revocation on password change & logout, per-account login lockout, trust-proxy, encryption fail-closed, transaction/expense positive-amount + approval segregation, coupon cap, order stale-coupon clamp, inventory link, user-reassignment branch-scope, and assorted UI fixes (CommandPalette, ReservationForm, dead links).

**Deep pass 2 (25 confirmed) — all CRITICAL/HIGH/MEDIUM fixed:** rank guard on user management (admin could disable/delete/block/read a super_admin or peer admin — CRITICAL), empty-location IDOR bypass, CSRF protection for cookie auth, Socket.io tenant-isolation leaks (notifications + `order:new` were broadcast across branches), mass-assignment/over-posting on coupon/reservation/table updates, cross-branch menu toggle, promoteUser peer loophole, logout→POST; plus UI/flow: order search stale closure, BillPreview false-success, destructive-action confirmations (orders + coupons), chef/staff loading hangs, menu stale image preview, duplicate login toast + credential console.log.

