# Cafe Project Deep Review - Pass 2

Date: 2026-06-20
Scope: current workspace only, read-only code review plus validation commands. No existing project files were edited.

## Executive Summary

Several first-pass issues appear improved in the current code: impersonation is now super-admin only, `/locations` is authenticated, transaction and notification writes have permission gates, order coupon usage is incremented, and table update no longer accepts `locationId` moves.

Current production blockers still remain around public booking, branch scoping, staff/chef permissions, menu scope, export filters, analytics leakage, and session security. The biggest risk is that the app has a single-branch/all-branches model, but not the requested "select multiple accessible branches and see combined totals" model.

## Read-only Validation

- Server syntax: PASS. `node --check` passed for 95 server JS files.
- Client lint: FAIL. `npm run lint -- --quiet` reported 11 errors in `branch-presence`, admin order pages, dashboard layout, staff orders, and staff dashboard, mostly React `set-state-in-effect` rule violations.
- Server audit: FAIL. 10 production dependency vulnerabilities: 4 high, 6 moderate. Packages include `multer`, `nodemailer`, `tmp`, `ws`, `qs`, `uuid` via `exceljs`.
- Client audit: FAIL. 6 production dependency vulnerabilities: 4 high, 2 moderate. Packages include `next`, `js-cookie`, `form-data`, `dompurify`, `ws` via socket stack.

## P0 - Must Fix Before Production

~~### 1. Fixed~~



~~### 2. Fixed~~

~~### 3. Fixed~~

~~### 4. Fixed~~

## P1 - High Risk

~~### 5. Fixed~~

~~### 6. Fixed~~

~~### 7. Fixed~~

~~### 8. Fixed~~

~~### 9. Fixed~~

~~### 10. Fixed~~

## P2 - Functional Gaps

~~### 11. Fixed~~

~~### 12. Fixed~~

~~### 13. Fixed~~

~~### 14. Fixed~~

~~### 15. Fixed~~

~~### 16. Fixed~~

~~### 17. Fixed~~

## P3 - Production Hardening

~~### 18. Fixed~~

~~### 19. Fixed~~

~~### 20. Fixed~~

## Suggested Fix Order

1. Fix public booking flow and `/locations` scoping.
2. Decide role permission defaults for staff, chef, branch_admin, and admin; update creation/promote flows.
3. Lock menu endpoints to branch scope and remove global staff/chef mutations.
4. Add multi-branch array filtering end-to-end.
5. Correct export filters and analytics access checks.
6. Remove localStorage JWT and align socket/session revocation.
7. Fix broken `/categories/all`, reservation notifications, and staff/branch-admin UI mismatches.
