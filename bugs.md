# CafeOS — Bugs, Vulnerabilities & Gaps

_Generated from multi-agent audits (security, permissions/RBAC, and a UI/flow/feature pass), each finding adversarially verified against the actual code. A second deep security pass and the UI/flow/feature pass are still running — those sections are marked **🔄 in progress** and will be appended/finalised._

**Status legend:** ✅ fixed & pushed &nbsp;|&nbsp; ⚠️ partial / needs an operational action &nbsp;|&nbsp; ⬜ open / not yet fixed &nbsp;|&nbsp; 🧭 intended behaviour (kept by design)

## Summary

| Area | Found | Fixed | Open / Operational |
|---|---|---|---|
| Security (pass 1) | 34 | ~26 ✅ | ~8 (rotation, intended, deferred) |
| Permissions / RBAC | 16 keys + route gaps | 8→ works + 3 routes fixed | edge-cases noted |
| Security (deep pass 2) | 🔄 running | — | — |
| UI / Flow / Feature | 🔄 running | — | — |

> ⚠️ **Two action items only you can do (do before next deploy):**
> 1. **Rotate the leaked secrets** — `JWT_SECRET`, MongoDB Atlas password, Cloudinary API secret are in git **history** (commit `cfad6ae`). Anyone with the history can forge auth tokens. Rotate all three + purge history (BFG / `git filter-repo`).
> 2. **Set `ENCRYPTION_KEY`** in the backend host env — the backend now **fails closed in production** without it (won't boot). Keep it constant once set.

---

## 1. Security Vulnerabilities (pass 1 — 34 confirmed)

### 🔴 Critical
1. ⚠️ **Live secrets committed in git history** — `server/.env` (commit `cfad6ae`). JWT signing secret (`this_is_a_complete_cafe_system`), Mongo creds, Cloudinary secret. With the secret anyone can forge a valid JWT for any user (incl. super_admin) → full auth bypass. _Done: root `.gitignore` added. **You must:** rotate all three + purge history._

### 🟠 High
2. ✅ **Hardcoded fallback Aadhaar encryption key + static salt** — `server/utils/encryption.js:10`. Fallback key is in source → stored Aadhaar trivially decryptable. _Fixed: fails closed in production when `ENCRYPTION_KEY` unset (set the env)._ (= findings #4, #6)
3. 🧭 **getUser returns decrypted Aadhaar to any managing admin** — `server/controllers/userController.js:462-479`. _Kept intentionally — you asked for Aadhaar to be visible in the staff detail view. Reconsider restricting to higher roles if needed._
4. ✅ **updateOrderItems keeps a stale coupon discount** when items are reduced (discount can exceed the new total → negative payable) — `server/services/orderService.js`. _Fixed: discount re-clamped to the new total._
5. ✅ **No `trust proxy`** → rate limiters key off the proxy IP, defeating login throttling — `server/app.js`. _Fixed: `app.set('trust proxy', 1)`._

### 🟡 Medium
6. ✅ **Session revocation dead code** — password change didn't bump `sessionVersion`, so old JWTs stayed valid — `userController.js`. _Fixed: `changePassword` bumps `sessionVersion`._
7. ⬜ **Logout doesn't revoke the JWT server-side** — only clears the cookie — `authController.js logoutUser`. _Open (accepted): cookie-clear is the practical logout; full revocation needs a token blacklist._
8. ✅ **updateMenuItem global-item guard missing** — a non-manager editing a global item silently demoted it org-wide — `menuItemController.js`. _Fixed: blocked unless super_admin / `manageGlobalMenu`._
9. ✅ **getUsers list leaks encrypted Aadhaar ciphertext** (`.lean()` strips getters) — `userController.js`. _Fixed: `aadharNumber` excluded from the list selection._
10. ✅ **Regex injection / ReDoS** via unescaped search/month into `$regex` — `superAdminController.js:134`, `salaryController.js:27,129`, `analyticsController.js:483`, `attendanceController.js:190`. _Fixed: `escapeRegex()` applied everywhere._ (= #12–15, #24)
11. ✅ **Branch Presence dead link** — bounced by the layout guard for branch/location admin. _Fixed: added to shared prefixes._
12. ✅ **location_admin falls through to the staff/chef sidebar**. _Fixed: now builds Operations/Analytics/Rewards groups._
13. ✅ **Manual transaction/expense amount not validated positive** — a negative EXPENSE posted as profit — `transactionController.js`, `expenseController.js`. _Fixed: positive-amount check._
14. ✅ **Approval lacks segregation of duties** — creator could approve their own entry — `expenseController.js`, `transactionController.js`. _Fixed: creator can't approve/reject own._
15. ✅ **generatePayroll defaults to ₹300/day** for staff with unset salary — `salaryController.js`. _Fixed: defaults to 0._

### ⚪ Low
16. ✅ **getAuditLogs ignores clampLimit** (raw client `limit`) — `superAdminController.js`. _Fixed: uses clamped `limitNum`._ (= #25)
17. ✅ **Customer listing trusts a user `sort` string** — `customerController.js`. _Fixed: sort field whitelisted._
18. ✅ **Branch-admin "Inventory" link → admin-only GETs** (broken page) — `inventoryRoutes.js:18,20`. _Fixed: inventory reads opened to branch_admin / `manageOrders` holders via `checkRoleOrPermission`; the controller already branch-scopes results (`scopedLocationId`), so no cross-branch leak._
19. ✅ **exitImpersonation hard-redirect to /dashboard/admin/users** bounced non-admin impersonators — `AuthContext.js`. _Fixed: routes to `/dashboard`._
20. ✅ **ReservationForm availability stale-result race** — `ReservationForm.js`. _Fixed: cancellation guard._
21. ✅ **CommandPalette arrow-key ÷0 → NaN** — `CommandPalette.js`. _Fixed: empty-results guard._
22. ✅ **Coupon percentage not capped at 100%** — `couponController.js`. _Fixed: capped + positive on create/update._
23. ✅ **No startup env validation** — `server/server.js`. _Fixed: fails fast if `JWT_SECRET`/`MONGO_URI` missing._
24. ⬜ **No per-account login lockout** (only IP throttle) — `authRoutes.js`. _Open (deferred): trust-proxy part done; per-account lockout is a larger feature._
25. ⬜ **reservationController returns raw `error.message`** bypassing central error handling — `reservationController.js`. _Open (minor/cosmetic)._
26. ⬜ **Abandoned `xss-clean` dependency declared but unused** — `server/package.json`. _Open (minor): remove the dep or wire input sanitisation._

---

## 2. Permissions / RBAC

The 16 grantable permissions were audited end-to-end (backend enforcement + frontend surfacing). **Originally 4 worked, 11 were "partial" (backend enforced but the UI only surfaced them for branch_admin/admin), 1 was "broken".** After fixes:

- ✅ **Sidebar + layout** now surface every permission-gated page for **any** role granted the permission (`GRANTABLE_PAGES` + `PAGE_PERMISSIONS` completed).
- ✅ **`manageGlobalMenu`** toggle now respects the permission, not just role.
- ✅ **`exportReports`, `manageCoupons`, `forceComplete`** routes made purely permission-driven (a leading `checkRoles` was 403-ing granted lower roles before the permission check ran).
- ✅ **`sendGlobalNotifications`** accepted alongside `manageNotifications` on the notification routes.
- ✅ **impersonate** page now lists branch staff/chef for a granted `location_admin`.

Re-verification: **works 4 → 8**, partial 11 → 6. Remaining "partial" are acceptable edge-cases (e.g. a granted staff with `impersonateUsers` has no one below them to impersonate; `manageGlobalMenu` for staff still needs menu access which is admin/branch-level).

**Minor open item:** ✅ `updateUser` now validates that any new `assignedLocation`/`accessibleLocations` are within the actor's own scope — a non-super admin can no longer move a user to a branch they don't manage.

---

## 3. UI Bugs

_🔄 A dedicated UI audit is running; full results will be appended. Confirmed so far (from pass 1):_

- ✅ **CommandPalette** arrow-key navigation divided by zero on empty results (NaN selected index); quick-nav buttons not keyboard-reachable.
- ✅ **ReservationForm** availability check had no out-of-order/abort guard (a stale response could overwrite the latest).
- ✅ **location_admin** got the wrong (staff-style) sidebar.
- ⬜ **Branch-admin Inventory** menu item leads to a page whose initial calls are admin-only (errors on load).

---

## 4. User-Flow Issues

_🔄 The flow audit is running; results will be appended. Confirmed so far:_

- ✅ **Branch Presence** / **exit-impersonation** dead-ends (links/redirects bounced by the route guard) — fixed.
- ✅ **Add Member** flow moved into the dashboard as a single-page form; Aadhaar number + image required, profile photo optional.
- ⬜ **Password change** now forces re-login (sessionVersion bump) — verify the UI handles the resulting 401 gracefully (flow audit will confirm).

---

## 5. Feature Gaps & Correctness

_🔄 The feature audit is running; results will be appended._

---

## 6. Audits in progress

- **Deep security pass 2** (`deep-vuln-audit-2`) — IDOR / object-level authz, mass-assignment, CSRF, file-upload, Socket.io authz, tenant/branch isolation, race conditions, privilege-escalation.
- **UI / Flow / Feature audit** (`ui-flow-feature-audit`) — rendering & state bugs, UX/error states, responsive/theme/a11y, auth/order/ops flows, FE↔BE feature mismatch, data-consistency.

Both run with adversarial verification; their confirmed findings will be merged into sections 1, 3, 4 and 5 above.
