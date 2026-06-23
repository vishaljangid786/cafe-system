# CafeOS — Bugs, Vulnerabilities & Gaps

_Last updated: 2026-06-23._

## ✅ No open issues

The deep scan's findings have all been fixed and removed. Nothing is outstanding in code.

### Verified
- **Server:** `npm test` (smoke) — **PASS** (whole module graph loads).
- **Client:** `npm run lint` — **0 errors**.

### Fixed in this pass
- **Reply permission gap** — you can now reply to anyone who messaged you (a `replyTo` exception in `createNotification`), even a superior outside your default targets.
- **`updateReservation`** — now whitelists editable fields and validates amounts/status (no more raw `req.body` spread).
- **Customer model** — `min: 0` on `visits` / `totalSpend` / `loyaltyPoints`.
- **Salary pages (branch-admin + location-admin)** — removed the fake "+4.2%" trend (now shows real staff count), fixed the "undefined" late-marks cell (now "Payable Days"), and replaced the dead "Export PDF" button + fake "slip downloaded" toast with a **real client-side CSV export** (whole list + per-staff slip).
- **Native `confirm()` → themed `ConfirmDialog`** via a new `useConfirm()` hook, across admin orders / coupons / menu, the Command Palette (impersonate), and the Permission Manager (delete role).

### Checked, not bugs (false positives from the scan)
- `target="_blank"` links already carry `rel="noreferrer"` (which implies `noopener`) — no tab-nabbing risk.
- The `bg-white/5` cards in `staff/attendance` sit on a `bg-(--color-surface-dark) text-white` hero — intentional frosting, fully visible.

---

_See the git log / `server/DEPLOYMENT.md` for prior remediation history and the one-time production secret-rotation steps._
