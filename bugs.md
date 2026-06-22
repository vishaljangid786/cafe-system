# CafeOS — Bugs, Vulnerabilities & Gaps

_Resolved items are **removed** from this file as they're fixed (see git log for the history). What remains below is the still-open work: operational actions, design decisions, and audits in progress._

_Last updated: 2026-06-22._

---

## ⚠️ Operational action items — only you can do these (before next deploy)

_Done for you locally:_ a **fresh strong `JWT_SECRET` and `ENCRYPTION_KEY` are now in `server/.env`** (gitignored), `server/.env.example` documents every required var, and the old `.env` is untracked. Remaining steps need your dashboards / host:

1. **Rotate the leaked secrets** (they're still in git **history**, commit `cfad6ae:server/.env`). On the dashboards: rotate the **MongoDB Atlas** DB-user password (stop using `demo`) and regenerate the **Cloudinary** API secret. Then set on your **backend host** env: the new `JWT_SECRET` + `ENCRYPTION_KEY` (from `server/.env`), the new `MONGO_URI` (with the rotated password) and the new Cloudinary secret. Finally purge the file from history (`git filter-repo --path server/.env --invert-paths` or BFG) and force-push — _say the word and I'll run the history purge for you._
2. **Set `ENCRYPTION_KEY` on the host** to the **same value** that's now in `server/.env` (local and host share the Atlas DB, so the key must match). The backend **fails closed in production** without it. Keep it constant.

---

## 🧭 Kept by design (decided)

- **`getUser` shows the FULL decrypted Aadhaar (all 12 digits) to a managing admin** (`userController.js`). Confirmed desired — Aadhaar is visible in the staff detail view, no masking.

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
