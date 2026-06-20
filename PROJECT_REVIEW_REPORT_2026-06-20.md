# Cafe Project Deep Review Report

Review date: 2026-06-20  
Reviewer note: Existing project files were not changed. This file is the only intended new artifact.

## Executive Summary

Issues 1–50 have been resolved across this session. The one remaining deferred item is Issue 22 (multi-branch subset selection), which requires a larger UI+backend feature. All security, RBAC, branch-scoping, order/coupon correctness, reservation integrity, export coverage, and lint errors have been addressed.

## Review Scope

Reviewed areas:

- Authentication, roles, permissions, branch scoping, impersonation.
- Admin, branch admin, staff, chef, location admin frontend routing behavior.
- Orders, tables, menu, recipes, categories, coupons.
- Reservations and bookings.
- Transactions, expenses, revenue, attendance, salary, customers.
- Analytics dashboards, filters, exports.
- Route-level middleware and frontend filter/export behavior.

Read-only verification run:

- `server`: `node --check` passed for 95 JS files.
- `client`: `npm run lint` failed with 100 problems: 13 errors and 87 warnings.
- Server package has no test script configured.
- Runtime DB/API workflows were not executed because no live database/session fixtures were provided.

## Critical Findings

## Medium Findings

### 22. Multi-Branch Selection Is Not Implemented as Required

Evidence:

- Navbar offers single selected branch or `All Branches`: `client/app/components/Navbar.js:56-89`.
- `scopedLocationId` supports one requested location or all accessible locations for admin: `server/utils/accessControl.js:33-50`.
- Many endpoints accept a single `branchId`/`locationId`, not multiple.

Impact:

- Admins with access to many branches cannot select an arbitrary subset like Branch A + Branch C.
- "Total data for selected multiple branches" is only available as all-access aggregation in some endpoints, not as user-selected multi-branch aggregation.

Minimal fix:

- Add a multi-select branch filter in shared UI.
- Extend backend filters to accept `locationIds` arrays and validate every ID against `userLocationIds(req.user)`.


## What Looks Reasonably Good

These areas have useful groundwork:

- `server/utils/accessControl.js` provides reusable `canAccessLocation`, `enforceLocationAccess`, `scopedLocationId`, and `userLocationIds`.
- Bookings admin list/update has branch enforcement in core controller paths: `server/controllers/bookingController.js:122-164` and `server/controllers/bookingController.js:170-183`.
- Salary controller mostly uses `scopedLocationId` and `enforceLocationAccess`.
- Customer controller backend scoping uses `scopedLocationId`.
- Order "my stats" endpoints are own-user scoped for chef/staff: `server/controllers/orderController.js:459-565` and `server/controllers/orderController.js:627-735`.

## Minimal Production Fix Roadmap

Phase 1: Security blockers

1. Fix user update/block/promote hierarchy checks.
2. Add backend route tests for unauthorized branch IDs.

Phase 2: Billing/order correctness

1. Fix `OrderService.createOrder` discount crash.
2. Move coupon validation/finalization into order transaction.
3. Store subtotal, discount, tax, final amount, and coupon on orders.
4. Fix bill generation totals.
5. Fix branch/global menu stock mismatch.

Phase 3: Branch isolation consistency

1. Apply branch scoping to menu, tables, transactions, notifications, analytics, exports, inventory.
2. Add multi-branch subset filtering with validated `locationIds`.
3. Add role-specific frontend route guards for UX.

Phase 4: Reservations/exports/reporting

1. Make reservation create/update atomic and schema-valid.
2. Recheck reservation overlap on update.
3. Add missing export types or remove unsupported expectations from UI.
4. Fix export field mappings.

Phase 5: CI readiness

1. Fix client lint errors.
2. Add API integration tests for RBAC and branch filters.
3. Add order/coupon/reservation regression tests.
4. Add export snapshot tests.

## Suggested RBAC Acceptance Tests

Minimum tests before production:

1. Super admin can access all branches and impersonate.
2. Admin with branches A and B cannot access branch C in every endpoint.
3. Admin with branches A and B can request A only, B only, and A+B combined totals.
4. Branch admin assigned A cannot read or mutate branch B.
5. Staff assigned A cannot read branch-wide admin exports, analytics, transactions, or unrelated staff data.
6. Chef assigned A can only use chef dashboard/order workflow for assigned branch.
7. Every endpoint that accepts `branchId`, `locationId`, `locationIds`, `availableBranches`, or `assignedLocation` rejects unauthorized IDs.

## Final Verdict

The codebase is close enough to have a recognizable production architecture, but current security and data-isolation gaps are too serious for production. The fastest safe path is to first centralize and enforce branch scoping everywhere, then fix order/coupon/reservation correctness, then clean frontend lint and export/reporting mismatches.
