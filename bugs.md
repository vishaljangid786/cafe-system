# CafeOS — Bugs, Vulnerabilities & Gaps

_Resolved items are **removed** from this file as they're fixed (see git log for the history). What remains below is the still-open work: operational actions, design decisions, and audits in progress._

_Last updated: 2026-06-22._

---

## 🔄 Pass 3 — A-to-Z inspection (in progress)

A full-stack senior-inspector pass is running across all 14 feature areas (auth, users, orders, menu, tables/reservations, money, payroll, analytics, inventory, notifications/realtime, locations/customers, super-admin, + cross-cutting data-correctness and frontend-UX). Each endpoint/page/flow is traced end-to-end and every finding is adversarially verified against the already-patched code. **Confirmed new findings will be written here** (by severity) as they land; CRITICAL/HIGH/MEDIUM will then be fixed and removed.

### Pass 3 findings — _populating…_

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
