# CafeOS — Bugs, Vulnerabilities & Gaps

_Resolved items are **removed** from this file as they're fixed (see git log for the history). What remains below is the still-open work: operational actions, design decisions, and audits in progress._

_Last updated: 2026-06-22._

---

## ⚠️ Operational action items — only you can do these (before next deploy)

1. **Rotate the leaked secrets.** `JWT_SECRET`, MongoDB Atlas password, and the Cloudinary API secret are in git **history** (commit `cfad6ae:server/.env`). Anyone with the history can forge a valid JWT for any user (incl. super_admin) → full auth bypass. **Do:** generate a new `JWT_SECRET`, rotate the Atlas DB-user password (stop using `demo`), regenerate the Cloudinary secret, then purge the file from history (`git filter-repo` / BFG) and force-push. Inject secrets only via host env going forward.
2. **Set `ENCRYPTION_KEY`** in the backend host environment. The backend now **fails closed in production** (won't boot) without it. Keep the value constant once set, or existing encrypted Aadhaar records won't decrypt.

---

## 🧭 Kept by design (not bugs — confirm if you want changed)

- **`getUser` returns the decrypted Aadhaar to a managing admin** (`userController.js`). Kept because you asked for Aadhaar to be visible in the staff detail view. If you'd rather restrict it (e.g. super_admin / admin only, or mask all but last 4 digits), say so and I'll lock it down.

---

## 🔄 Audits in progress — findings will be added here when they complete

Two adversarially-verified audits are running; their confirmed new findings will be appended below and then fixed:

- **Deep security pass 2** — IDOR / object-level authorization on every `:id` route, mass-assignment / over-posting, CSRF (cookie auth), file-upload safety, Socket.io authorization, tenant/branch isolation bypass, race conditions, privilege-escalation via update.
- **UI / Flow / Feature audit** — UI rendering & state bugs, UX/error states, responsive/theme/accessibility, auth/order/ops flow breakages, FE↔BE feature mismatch, data-consistency.

### Security (pass 2) — _pending_

### UI bugs — _pending_

### User-flow issues — _pending_

### Feature gaps & correctness — _pending_

---

## ✅ Resolved this session (summary — details in git log)

All **34** pass-1 security findings are now either fixed or covered by the operational/by-design items above, and the **16-permission RBAC** review is resolved (every granted permission now works end-to-end; `exportReports`/`manageCoupons`/`forceComplete` made permission-driven; sidebar/page-access completed). Notable fixes pushed: register privilege-escalation, password/Aadhaar response leaks, destructive password-reset migration removed, regex-injection hardening, session revocation on password change & logout, per-account login lockout, trust-proxy, encryption fail-closed, transaction/expense positive-amount + approval segregation, coupon cap, order stale-coupon clamp, inventory link, user-reassignment branch-scope, and assorted UI fixes (CommandPalette, ReservationForm, dead links).
