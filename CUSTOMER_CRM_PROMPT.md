# Customer CRM + QR Self-Registration + New-Customer Discount + Birthday Coupons — Implementation Prompt

> Paste this whole file as the task prompt. It is written against the **actual** current
> state of this repo (verified file-by-file). Every path, symbol and contract named below
> exists today unless explicitly marked **NEW**.
>
> **Golden rule: additive only.** Do not rewrite existing pages, do not rename existing
> API routes, do not change existing response shapes. Everything below either adds a new
> file, adds a field to an existing model, or appends a block to an existing file.

---

## 0. What already exists (do not re-invent it)

| Thing | Where | State |
|---|---|---|
| `Customer` model | `server/models/Customer.js` | Exists, but is **per-branch** (`{phone, branch}` unique). Has `visits`, `totalSpend`, `loyaltyPoints`, `lastVisit`, `favoriteItems`, `branch`. No name-required, no gender/dob/email, no cafe concept. |
| CRM upsert on order complete | `server/services/orderService.js` → `_handleCustomerCRM()` (~line 652), called from `updateStatus()` line 477 | Atomic `findOneAndUpdate` upsert on `{phone, branch}`, `$inc` visits/spend/points, mints loyalty reward coupon. Best-effort, wrapped in try/catch. |
| Customer API | `server/controllers/customerController.js` + `server/routes/customerRoutes.js`, mounted at `/api/customers` (`server/app.js:193`) | 4 read-only endpoints: `GET /`, `/top`, `/inactive`, `/analytics`. Already cafe/branch-scoped via `buildBranchFilter(req)` which reads `?locationId` + `?cafeId`. |
| Customers page | `client/app/dashboard/admin/customers/page.js` | KPI tiles + top/inactive lists + a read-only profile modal. Already reads `selectedCafe`/`selectedLocation` from `useAuth()`. |
| Page-access registry | `server/utils/pageAccess.js` (`page_customers`, group `Analytics`) mirrored in `client/app/config/pages.js` | `page_customers` **already exists** for super_admin/admin/branch_admin/location_admin. |
| Route registry | `client/app/config/routes.js` → `ROUTE_TABLE.page_customers` | canonical `/dashboard/admin/customers`, `paths: ['/dashboard/admin/customers']`. |
| Nav entry | `client/app/config/navigation.js` → `GRANTABLE_PAGES` has `{ name: 'Customers & CRM', pageKey: 'page_customers', icon: Crown }`. | Exists. |
| Action permissions | `server/utils/actionPermissions.js` (`ACTION_SCOPES`) mirrored in `client/app/config/actions.js` | **No `customers` scope yet — you will add one.** |
| QR self-order (public) | `server/controllers/publicController.js` + `server/routes/publicRoutes.js` at `/api/public`; client page `client/app/order/page.js` (step machine: `menu → checkout → upi → placing → placed`) | Already collects `name`, `phone`, `partySize`, `memberNames`, `payChoice`, `laterMethod`, `upiRef`. QR token validated via `assertValidTableQrToken`. |
| Staff POS order flow | `client/app/dashboard/admin/tables/page.js` (+ role mirrors `branch-admin`/`location-admin`/`staff` tables pages), `client/app/components/tables/AssignTableModal.js`, `client/app/components/tables/BillPreview.js` | `customerName` is **already required** before "Send to kitchen" (`handleSendToKitchen`, ~line 425) and before billing (`handleFinalizeSession`, ~line 369). **`customerPhone` is NOT collected. Payment method is passed only at bill time** (`data.append('paymentType', paymentType)`). |
| Coupons | `server/models/Coupon.js`, `couponController.js`, `couponRoutes.js`, page `client/app/dashboard/admin/coupons` | **Org-wide, no cafe/branch scoping, no audience targeting.** Route comment explicitly says so; create/edit restricted to `checkRoles('super_admin','admin')`. |
| Settings | `server/models/Settings.js` + `server/utils/settings.js` (`getSettings(branchId)`), merge chain `DEFAULTS < global doc (locationId:null) < branch doc` | Groups: `tax`, `payroll`, `loyalty`, `invoice`, `billing`, `general`, `payments`. **No `crm` group, no cafe tier.** |
| Scoping helpers | `server/utils/accessControl.js` | `scopedLocationId`, `scopedLocationIds`, `canAccessLocation`, `userLocationIds`, `isAllLocation`, `escapeRegex`, `clampLimit`, `endOfDay`. **Use these — do not hand-roll scoping.** |
| Date filter UI | `client/app/components/ui/UniversalDateFilter.jsx` | Emits `{ startDate, endDate }` (`YYYY-MM-DD`). Used by the Overview page. Reuse verbatim. |

---

## 1. Data model changes

### 1.1 `server/models/Customer.js` — evolve from per-branch to **global identity + per-cafe membership**

The user requirement is "ek customer, multiple cafes, har cafe me new/existing". The current
`{phone, branch}` unique index splits one human into N rows. Change it to:

```js
// Identity (global, one document per human)
phone:      { type: String, required: true, trim: true },   // digits only, normalized
name:       { type: String, trim: true, default: 'Valued Customer' },
gender:     { type: String, enum: ['male','female','other','prefer_not_to_say'], default: null },
dob:        { type: Date, default: null },        // OPTIONAL at capture, IMMUTABLE once set
dobLockedAt:{ type: Date, default: null },        // set the first time dob is written
email:      { type: String, trim: true, lowercase: true, default: null },

// Per-cafe membership — this is the `cafe_name = [cafe1 => "new", cafe2 => "existing"]`
memberships: [{
  cafe:        { type: ObjectId, ref: 'Cafe', required: true, index: true },
  status:      { type: String, enum: ['new','existing'], default: 'new' },
  branches:    [{ type: ObjectId, ref: 'Location' }],  // every branch of this cafe they've touched
  firstBranch: { type: ObjectId, ref: 'Location' },    // acquisition branch
  joinedAt:    { type: Date, default: Date.now },
  firstOrderAt:{ type: Date, default: null },          // set on FIRST completed order → status flips to 'existing'
  lastVisit:   { type: Date, default: null },
  orderCount:  { type: Number, default: 0, min: 0 },
  totalSpend:  { type: Number, default: 0, min: 0 },
  loyaltyPoints:{ type: Number, default: 0, min: 0 },
  newCustomerDiscountUsed: { type: Boolean, default: false },  // one-shot per cafe
  _id: false,
}],

// Roll-ups across all cafes (kept for the existing sort/KPI queries)
visits, totalSpend, loyaltyPoints, lastVisit, favoriteItems   // KEEP AS-IS
branch  // KEEP as "initial acquisition branch" — existing code reads it

// Provenance
source:   { type: String, enum: ['qr','pos','import'], default: 'pos' },
profileCompletedAt: { type: Date, default: null },   // set when the QR form is submitted
skippedAt: { type: Date, default: null },            // last time they dismissed the QR popup
```

Indexes:
```js
customerSchema.index({ phone: 1 }, { unique: true });          // NEW — global identity
customerSchema.index({ 'memberships.cafe': 1, 'memberships.status': 1 });
customerSchema.index({ 'memberships.branches': 1 });
customerSchema.index({ dobMonth: 1, dobDay: 1 });               // see below
customerSchema.index({ totalSpend: -1 });   // keep
customerSchema.index({ lastVisit: -1 });    // keep
// DROP the old { phone: 1, branch: 1 } partial-unique index (see migration).
```

For birthday lookups, store the derived month/day so "aaj kiska birthday hai" is an index
hit rather than an `$expr` scan:
```js
dobMonth: { type: Number, default: null, min: 1, max: 12 },
dobDay:   { type: Number, default: null, min: 1, max: 31 },
```
Set both in a `pre('save')`/`pre('findOneAndUpdate')` hook whenever `dob` is written.

**Enforce dob immutability at the model layer**, not just the controller: in the pre-hooks,
if `dobLockedAt` is already set and the incoming update changes `dob`, strip the change and
throw `Error('Date of birth cannot be changed once set')`.

### 1.2 Migration — **required**, `server/scripts/`

Add `server/scripts/migrateCustomersToGlobal.js` (follow the style of the existing
`server/migrateTransactions.js` and whatever lives in `server/scripts/`), and register it in
`server/utils/startupMigrations.js` so it runs once and is idempotent:

1. Group existing `Customer` docs by normalized `phone`.
2. For each group: pick the earliest-created doc as the survivor; for every doc in the group
   resolve `Location.findById(doc.branch).cafe` → push/merge a `memberships` entry
   (`branches` union, `orderCount = visits`, `totalSpend`, `loyaltyPoints`, `lastVisit`,
   `status = visits > 0 ? 'existing' : 'new'`, `firstBranch = doc.branch`).
3. Sum the roll-ups (`visits`, `totalSpend`, `loyaltyPoints`), `lastVisit = max`, merge
   `favoriteItems` maps by adding counts.
4. Delete the losers, save the survivor.
5. Drop the old `phone_1_branch_1` index, build the new ones.
6. Log a summary line. Make it re-runnable (guard on a `Settings`/marker flag or on "no
   duplicate phones remain").

Ship it with a `--dry-run` flag that prints the merge plan without writing.

### 1.3 `server/models/Coupon.js` — add scoping + audience (additive fields only)

```js
cafe:     { type: ObjectId, ref: 'Cafe', default: null },      // null = all cafes (legacy behaviour)
branches: [{ type: ObjectId, ref: 'Location' }],               // empty = all branches of `cafe`
audience: { type: String, enum: ['public','birthday','targeted'], default: 'public' },
assignedCustomers: [{ type: ObjectId, ref: 'Customer' }],      // for audience 'birthday' | 'targeted'
campaign: {                                                     // provenance for generated batches
  batchId:   { type: String, default: null, index: true },
  kind:      { type: String, enum: ['birthday','manual'], default: 'manual' },
  generatedAt: { type: Date, default: null },
},
```
Index: `couponSchema.index({ cafe: 1, isActive: 1 })`, `couponSchema.index({ audience: 1, 'campaign.batchId': 1 })`.

`appliesTo.items` / `appliesTo.categories` already exist — reuse them for
"any specific category or any specific item".

**`applyCoupon` in `server/controllers/couponController.js` must now also enforce:**
- if `coupon.cafe` is set → the order's branch must belong to that cafe;
- if `coupon.branches.length` → the order's branch must be in it;
- if `audience !== 'public'` → the order's `customerPhone` must resolve to a Customer whose
  `_id` is in `assignedCustomers`.
Return the existing error shape (`res.status(400); throw new Error(...)`) so the existing
tables-page toast still works.

### 1.4 `server/models/Settings.js` + `server/utils/settings.js` — new `crm` group and a **cafe tier**

Add to `DEFAULTS` in `server/utils/settings.js`:
```js
crm: {
  newCustomerDiscountEnabled: true,
  newCustomerDiscountPercent: 20,   // the "20%" default from the requirement
  newCustomerMaxDiscount: null,     // ₹ cap, null = uncapped
  newCustomerMinOrder: 0,
  askProfileOnScan: true,           // show the QR popup at all
  profileRequired: false,           // false = customer can Skip
},
```

Extend the merge chain from `DEFAULTS < global < branch` to
**`DEFAULTS < global < cafe < branch`**:
- add `cafeId: { type: ObjectId, ref: 'Cafe', default: null, index: true }` to `Settings`;
- update the existing unique index so it is `{ locationId: 1, cafeId: 1 }` (exactly one
  global doc, one per cafe, one per branch — keep the partial-index comment style already in
  the file);
- `getSettings(branchId)` resolves `Location.findById(branchId).cafe` and layers the cafe doc
  between global and branch. **Cache-safe**: keep whatever memoisation `settings.js`
  currently does, and key it by branch id as before.

This is what makes "super-admin any cafe me discount set kare, admin apne cafe me, branch
admin apni branch me" work with **one** mechanism.

---

## 2. Server — new/changed endpoints

### 2.1 Public (unauthenticated) — `server/controllers/publicController.js` + `server/routes/publicRoutes.js`

> ⚠️ **Security — read this before writing code.** A public "give me the profile for this
> phone number" endpoint is a PII-enumeration hole: anyone could iterate numbers and harvest
> names, emails and DOBs. The design below avoids it. Do not simplify it away.

**Identity model for the scan page:** after the customer submits (or is recognised), the
server returns an opaque **`customerToken`** — an HMAC of `customerId` signed with
`process.env.JWT_SECRET` (reuse `server/utils/encryption.js` if it already exposes an HMAC
helper; otherwise `crypto.createHmac('sha256', secret)`), format `"<customerId>.<sig>"`,
with a `v1` prefix. The client stores it in `localStorage` under `cafeos_customer_token`.
Subsequent scans send it and get their profile back **without ever sending a bare phone
number to a lookup endpoint**. Compare signatures with `crypto.timingSafeEqual` — the file
already has `safeTokenEquals()` for exactly this, reuse it.

Add these routes (all under the existing `/api/public` mount, all behind the same rate
limiter the file already applies — check `server/routes/publicRoutes.js` and reuse it, plus
a tighter limiter for the two write endpoints):

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| `GET` | `/api/public/customer/me` | `?token=<customerToken>&branchId=` | `{ known: true, profile: { name, phone (masked except last 4), gender, dob, email, dobLocked: true/false }, membership: { status, isNewHere }, offer: { discountPercent, maxDiscount, label } }` or `{ known: false }` |
| `POST` | `/api/public/customer/profile` | `{ branchId, tableId, qrToken, name, phone, gender, dob?, email?, token? }` | Upserts by phone. Returns `{ customerToken, profile, membership, offer }` |
| `PATCH` | `/api/public/customer/profile` | `{ token, name?, gender?, email?, phone?, dob? }` | Edits. **`dob` is rejected with 400 if `dobLockedAt` is set.** Returns updated profile. |
| `POST` | `/api/public/customer/skip` | `{ branchId, token? }` | Records `skippedAt`; returns `{ ok: true }`. No customer is created if there is no token. |

Rules for `POST /customer/profile`:
- `branchId` must be a valid, non-`deleted`/non-`inactive` `Location` — mirror the exact
  check already in `getPublicMenu`/`createPublicOrder`.
- If `tableId` is given, `assertValidTableQrToken(res, table, qrToken)` — **reuse the existing
  helper**, do not write a new one.
- Normalize phone with the same rule already used in `createPublicOrder`:
  `String(phone).replace(/\D/g,'').slice(0,15)`, reject `< 10` digits with 400.
- Name required, `.trim().slice(0,120)`. Email: validate loosely, `.slice(0,160)`. `dob`: must
  parse, must be in the past, age between 5 and 120 → else 400.
- Resolve the branch's `cafe`. Upsert the `Customer` by phone; **`$addToSet` a membership**
  for that cafe with `status: 'new'` if absent, and `$addToSet` the branch into
  `membership.branches`. Set `profileCompletedAt` if unset, `source: 'qr'` on insert.
- **Phone change on PATCH**: if the new phone already belongs to a *different* Customer,
  return 409 `"That number is already registered"` — do not merge silently.
- `offer` is computed from `getSettings(branchId).crm` **and** the membership:
  `discountPercent = (crm.newCustomerDiscountEnabled && membership.status === 'new' && !membership.newCustomerDiscountUsed) ? crm.newCustomerDiscountPercent : 0`.

**`createPublicOrder` changes (same file):** accept an optional `customerToken` in the body.
If present and valid → resolve the customer, and if their membership for this cafe qualifies,
compute the new-customer discount **server-side** and pass it into `OrderService.createOrder`
as `discountAmount` (never trust a client-sent discount — the file's existing comment about
server-side price validation applies here too). Also stamp `order.customerId` (new field, §2.3).

### 2.2 Authenticated CRM — `server/controllers/customerController.js` + `server/routes/customerRoutes.js`

Keep all 4 existing endpoints and their response shapes untouched (the current page depends
on them). **Extend `buildBranchFilter(req)`** so it also understands the new membership shape:
when a cafe/branch filter is present, match on `memberships.cafe` / `memberships.branches`
instead of the flat `branch`. Keep the existing `scopedLocationId` + intersection logic —
including the comment about a cafe filter never *widening* a single-branch user's scope.

Add (all under the existing `router.use(verifyToken)` +
`checkRoles('admin','super_admin','branch_admin','location_admin')`):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/customers/report` | The main report. Query: `page,limit,search,sort,cafeId,locationId,startDate,endDate,status(new/existing/all),minOrders,hasDob,birthdayMonth`. Returns paginated rows + a `summary` block. |
| `GET` | `/api/customers/summary` | KPI block alone (for tile refresh): `{ totalCustomers, newInRange, repeatInRange, returningFromPrevPeriod, avgOrdersPerCustomer, avgSpend, activeCafeCount, withDob, withEmail }`. |
| `GET` | `/api/customers/:id` | Single customer 360: profile + `memberships` (populated cafe name, branch names) + lifetime stats. |
| `GET` | `/api/customers/:id/orders` | That customer's orders. Query: `startDate,endDate,cafeId,locationId,page,limit`. **Must be scoped**: a non-super_admin only sees orders from branches they can access. Returns `{ data: orders, totals: { count, amount }, byDate: [{date,count,amount}] }` for the per-customer chart. |
| `PATCH` | `/api/customers/:id` | Staff-side edit of `name/gender/email/phone`. **`dob` only writable if `dobLockedAt` is null.** Audit via `logActivity` (`server/utils/auditLogger.js`) like `couponController` does. |
| `GET` | `/api/customers/birthdays` | `?scope=today|week|month&cafeId=&locationId=` → customers whose `dobMonth`/`dobDay` fall in range, scoped. |
| `POST` | `/api/customers/campaigns/birthday` | Generates the birthday coupon batch (§2.4). |
| `GET` | `/api/customers/discount-config` | Effective `crm` settings for `?cafeId=` or `?locationId=`, plus which level it came from (`default/global/cafe/branch`). |
| `PUT` | `/api/customers/discount-config` | Writes the `crm` group. Body `{ cafeId? , locationId?, crm: {...} }`. **Authorisation:** super_admin → any cafe/branch; admin → only cafes in `req.user.cafes` / branches in `userLocationIds(req.user)`; branch_admin/location_admin → only their own branches (never the cafe tier). Reject with 403 via `enforceLocationAccess` / an explicit cafe check. |

**Date semantics for the report** (match the Overview page so the filters feel identical):
- `startDate`/`endDate` come as `YYYY-MM-DD`; use `endOfDay(endDate)` from `accessControl.js`.
- "New customers in range" = `memberships.joinedAt` (or `createdAt` when no cafe filter)
  inside the range.
- "Repeat / returning" = customers with ≥ 2 completed orders in range **or** whose
  `firstOrderAt < startDate` and who have ≥ 1 order inside the range. Implement both numbers,
  label them distinctly in the UI (`Repeat in period` vs `Returning from earlier`).
- All order-derived aggregates must filter `status: 'COMPLETED'` and use the
  `{ branch, status, createdAt }` compound index that already exists on `Order`.

### 2.3 `server/models/Order.js` — one new field

```js
customerId: { type: ObjectId, ref: 'Customer', default: null, index: true },
```
Populate it in `orderService._handleCustomerCRM()` (which already resolves/creates the
Customer) **and** in `createPublicOrder` when a `customerToken` is supplied. `customerPhone`
stays as-is — it is the fallback join key for historical orders and the existing
`{ customerPhone, branch }` index must not be dropped.

### 2.4 Birthday coupon generation

`POST /api/customers/campaigns/birthday`, body:
```jsonc
{
  "scope": "today",                 // today | week | month | custom
  "startDate": "2026-07-20",        // when scope=custom
  "endDate":   "2026-07-27",
  "cafeId":    "…",                 // required unless super_admin passes "all"
  "branchIds": ["…"],               // optional narrowing
  "discountType": "percentage",     // percentage | fixed
  "discountValue": 50,
  "maxDiscount": 300,
  "minOrderAmount": 0,
  "validDays": 7,                   // → expiryDate
  "appliesTo": { "items": [], "categories": [] },   // empty = all items
  "codePrefix": "BDAY",
  "perCustomerCode": true           // true = unique code each; false = one shared code
}
```
Behaviour:
- Resolve the target customers via the same scoping helpers (403 if the caller can't reach
  the requested cafe/branches).
- `perCustomerCode: true` → create one `Coupon` per customer with
  `usageLimit: 1`, `audience: 'birthday'`, `assignedCustomers: [customerId]`,
  `cafe`, `branches`, `campaign: { batchId, kind: 'birthday', generatedAt }`.
  Code = `${codePrefix}-${6 random base36 upper}` — **retry on duplicate-key** (the `code`
  index is unique) rather than assuming uniqueness, the loyalty-reward code in
  `orderService` has the same weakness and you should not copy it.
- `perCustomerCode: false` → a single coupon with `assignedCustomers: [...all]` and
  `usageLimit: assignedCustomers.length`.
- Use `Coupon.insertMany(..., { ordered: false })` for the batch.
- Return `{ batchId, created, skipped, sample: [first 5 codes] }`.
- Audit with `logActivity`. Optionally fire `notifyCustomer()` from
  `server/services/customerNotify.js` per customer (guard behind a `notify: true` flag — it
  is an outward-facing send, so default it **off**).
- Add `GET /api/customers/campaigns` to list past batches (group `Coupon` by
  `campaign.batchId`) so the page can show history and allow a batch-level deactivate
  (`PATCH /api/customers/campaigns/:batchId { isActive: false }`).

### 2.5 New-customer discount application (the actual money path)

Two entry points, **both server-side**:

1. **QR order** — `createPublicOrder`, as described in §2.1.
2. **Staff POS order** — `server/controllers/orderController.js` `createOrder` and the table
   billing path in `server/controllers/tableController.js`. When the incoming
   `customerPhone` resolves to a Customer whose membership for this branch's cafe is
   `status: 'new'` and `newCustomerDiscountUsed === false`, auto-apply the configured
   percentage and return it in the response so the POS can show
   "New customer discount −₹X (20%)".

In **both** cases, the flag is consumed exactly once, atomically, at order **completion**
(inside `orderService._handleCustomerCRM`, which is already the single place that runs on
`COMPLETED`):
```js
Customer.findOneAndUpdate(
  { _id: customerId, memberships: { $elemMatch: { cafe: cafeId, newCustomerDiscountUsed: false } } },
  { $set: { 'memberships.$.newCustomerDiscountUsed': true,
            'memberships.$.status': 'existing' },
    $min: { 'memberships.$.firstOrderAt': new Date() } },
  { new: true }
)
```
The conditional filter is what guarantees a concurrent double-complete can't grant the
discount twice — same pattern the file already uses for the loyalty-points claim.

**This is the "first order ke baad new → existing" transition.** Nothing else may write
`status`.

`_handleCustomerCRM` must also, in the same update: `$addToSet` the branch into
`memberships.$.branches`, `$inc` `memberships.$.orderCount` / `totalSpend` /
`loyaltyPoints`, and keep `$inc`-ing the existing top-level roll-ups so the current
`/top`, `/inactive` and `/analytics` endpoints keep working unchanged. Keep the whole thing
inside the existing try/catch — **a CRM failure must never fail a finalized order.**

### 2.6 Permissions — `server/utils/actionPermissions.js` + `client/app/config/actions.js`

Append a new scope (keep both files in sync — the file header says so):
```js
{
  scope: 'customers', pageKey: 'page_customers', label: 'Customers & CRM',
  actions: [
    { action: 'modify',   label: 'Edit customer details',            legacy: { roles: ['admin','branch_admin','location_admin'], perms: ['viewAnalytics'] } },
    { action: 'discount', label: 'Set new-customer discount',        legacy: { roles: ['admin','branch_admin'], perms: [] } },
    { action: 'campaign', label: 'Generate birthday / offer coupons',legacy: { roles: ['admin'], perms: ['manageCoupons'] } },
    { action: 'export',   label: 'Export customer report',           legacy: { roles: ['admin','branch_admin','location_admin'], perms: ['exportReports'] } },
  ],
},
```
Gate the write endpoints with `checkAction('customers.modify' | '.discount' | '.campaign')`,
following the `couponRoutes.js` pattern (role gate *before* action gate).

`page_customers` already exists in `pageAccess.js` — **do not add a new page key.**

---

## 3. Client — QR scan flow

**File: `client/app/order/page.js`** (single file, 719 lines, step machine already present).

Add a `profile` step **before** `menu` renders its first interaction — actually, do it as a
**modal overlay on top of the menu step**, so the customer can browse while dismissing it:

1. On mount, after the public-menu fetch resolves, read `localStorage.cafeos_customer_token`.
   - Token present → `GET /api/public/customer/me?token=…&branchId=…`.
     - `known: true` → **never show the form again.** Show a slim greeting bar:
       `"Welcome back, {name} · ✎ Edit details"` and, if `offer.discountPercent > 0`,
       a badge `"{n}% off your first order here"`.
     - Token invalid/expired → clear it, fall through to (2).
   - No token → (2).
2. If `crm.askProfileOnScan` (surface it in the `getPublicMenu` payload alongside the
   existing `payments` block — extend `publicPayments()`'s sibling, don't overload it), show
   the **first-visit sheet**:
   - Fields: **Name** (required), **Mobile** (required, 10-digit), **Gender**
     (segmented: Male / Female / Other / Prefer not to say), **DOB** (optional, date input —
     use the existing `client/app/components/ui/DateInputEnhancer.js`), **Email** (optional).
   - Copy under DOB: *"Birthday par special offers ke liye. Ek baar set hone ke baad change
     nahi hoga."*
   - Primary CTA: **"Get {n}% off"** (falls back to "Continue" when the configured percent
     is 0 / disabled). Secondary: **"Skip"** → `POST /api/public/customer/skip`, sheet does
     not reappear for this session (`sessionStorage`), and reappears on the next scan only if
     they still have no token.
3. On submit → `POST /api/public/customer/profile` → store the returned `customerToken`,
   prefill the existing `name`/`phone` state (they already exist, lines 59–60) so the
   `checkout` step is pre-filled and the customer never retypes.
4. **Edit details** → the same sheet in edit mode via `PATCH`, with **DOB rendered read-only
   and greyed with a lock icon when `profile.dobLocked` is true**.
5. In the `checkout` step, if `offer.discountPercent > 0`, show the discount line in the
   total breakdown — **display only**; the authoritative number comes back from the order
   response.
6. Send `customerToken` in the `createPublicOrder` body (the payload is built around line
   219 — add one field, change nothing else).

Reuse the file's existing visual language (the step components, `motion` transitions, the
`bg-(--color-surface)` / `text-(--color-text-primary)` CSS-variable classes). Do not
introduce a new component library.

---

## 4. Client — staff POS: phone required + payment method at order time

Touch these, minimally:

- **`client/app/components/tables/AssignTableModal.js`** — it already has `customerName`
  state (line 15) and calls `onConfirm({ numberOfPeople, customerName })` (line 33). Add
  `customerPhone` state + input; make **both** required (disable the confirm button until
  name is non-empty and phone has 10 digits); pass it through in `onConfirm`.
- **`client/app/dashboard/admin/tables/page.js`** and its three role mirrors
  (`branch-admin/tables`, `location-admin/tables`, `staff/tables`):
  - `handleBookTable` already sends `{ numberOfPeople, customerName }` to
    `PUT /tables/:id/book` → add `customerPhone`.
  - `handleSyncOrders(..., { customerName })` (used by the inline input at ~line 808) → add
    the same for `customerPhone`, plus a phone input next to the existing name input.
  - `handleSendToKitchen` (~line 425): the existing guard is
    `if (!selectedTable.customerName) return toast.error('Customer name required')`.
    Add the phone guard right after it, and **add a payment-method selector (Cash / UPI)**
    to the order panel whose value goes into the `payload` as `paymentType`.
  - `handleFinalizeSession` (~line 369) already takes `paymentType` and appends it to the
    FormData — leave that path alone, just default it from the selection made at order time.
  - After a phone is entered, call `GET /api/customers?search=<phone>` (existing endpoint) to
    show an inline chip: **"New customer — 20% off applies"** or
    **"Returning · 12 visits · ₹8,400 lifetime"**. Purely informational; the discount is
    applied server-side.
- **`server/models/Table.js` / `server/controllers/tableController.js`** — accept and persist
  `customerPhone` on the table session alongside the existing `customerName`, and pass it into
  the order payload so `Order.customerPhone` is populated for POS orders too (today it is
  only reliably set on QR orders).
- **`client/app/components/tables/BillPreview.js`** — show the customer name + masked phone
  and the applied new-customer discount line on the printed bill.

**Do not** change `orderService.createOrder`'s signature; it already accepts
`customerName` / `customerPhone` / `paymentType`.

---

## 5. Client — the Customers page (the big one)

**File: `client/app/dashboard/admin/customers/page.js`** — extend the existing page. Do
**not** create a new route: `page_customers` → `/dashboard/admin/customers` is already wired
in `routes.js`, `navigation.js`, `pages.js` and the layout guard. Every role that can open it
(super_admin / admin / branch_admin / location_admin) uses the same URL — the *data* is what
differs, scoped server-side.

Layout, top to bottom:

1. **Filter bar** (sticky):
   - `UniversalDateFilter` (`client/app/components/ui/UniversalDateFilter.jsx`) — same
     component and same `{startDate,endDate}` contract as the Overview page.
   - **Cafe select** — visible for super_admin (all cafes) and admin (their cafes only).
     Feed it from the same source the top navbar uses (`useAuth()` → `selectedCafe`), and let
     the page-local select default to the navbar selection.
   - **Branch select** — options filtered to the chosen cafe; for branch_admin /
     location_admin this is pre-scoped and the cafe select is hidden.
   - **Status**: All / New / Existing. **Search**: name or phone.
   - Reuse `PremiumSelect` (`client/app/components/ui/PremiumSelect.js`) for the dropdowns.

2. **KPI tiles** (`StatWidget` / the existing tile markup — keep the visual style already in
   this file): Total customers · New in period · Repeat in period · Returning from earlier ·
   Avg orders/customer · Avg spend · At-risk (inactive 30d) · Birthdays this month.
   Wire to `GET /api/customers/summary`. Keep `StatGridSkeleton` for the refetch state — the
   page already does this correctly.

3. **Customer table** — `GET /api/customers/report`, paginated, sortable:
   Name · Phone (masked, reuse the page's existing `maskPhone`) · Status chip (New / Existing)
   · **Cafes** (chips, e.g. `Cafe A · Cafe B` with a `+2` overflow — this is the
   "kitne cafe ka user hai" view) · Orders · Total spend · First seen · Last visit · Actions.
   Row click → §5.1 drawer.

4. **Right rail**: keep the existing "Top Reward Earners" and "Customers to Win Back" panels —
   they already work and are wired to `/top` and `/inactive`.

5. **Toolbar actions** (each gated by the matching `customers.*` action permission):
   - **Discount settings** → §5.2 modal
   - **Birthday campaign** → §5.3 modal
   - **Export** → reuse `client/app/components/ui/ExportActions.js` + the existing
     `server/routes/exportRoutes.js` pattern (add a `customers` export type there).

### 5.1 Customer 360 drawer

Replace the current read-only `viewingCustomer` modal with a fuller drawer (same
`motion.div` + `bg-(--color-surface)` styling):
- Header: name, masked phone, gender, DOB (with a 🔒 when locked), email, "Customer since
  {firstSeen}" and "Active for {n} months".
- **Memberships list**: one row per cafe → cafe name, status chip, branches visited, joined
  date, orders, spend, whether the new-customer discount is still available.
- **Orders section**: `GET /api/customers/:id/orders` with its **own date filter** (a second
  `UniversalDateFilter` instance, independent of the page-level one — the requirement is
  explicitly "date wise bhi filter kar sakta hoon"). Table of order date/time, branch, items
  count, amount, payment type, status. Plus a small bar chart of orders-per-day from the
  `byDate` array (follow whatever chart lib the Overview / `StaffReportsAnalytics.js` pages
  already use — do not add a new one).
- **Edit** button → inline form for name / gender / email / phone; **DOB disabled when
  `dobLocked`**. `PATCH /api/customers/:id`.

### 5.2 Discount settings modal

- Scope selector: **Cafe-wide** or **Specific branch** (branch_admin / location_admin only
  get "branch", and only their own).
- Fields from the `crm` settings group: enable toggle, percent, ₹ cap, min order,
  "ask profile on scan", "profile required".
- Show an inheritance hint: *"Currently inherited from: Global default (20%)"* using the
  `level` field returned by `GET /api/customers/discount-config`.
- Save → `PUT /api/customers/discount-config`.

### 5.3 Birthday campaign modal

Mirrors the §2.4 body: scope (today / this week / this month / custom range) → live preview
count and the customer list; cafe + branch pickers; discount type & value; ₹ cap; min order;
validity days; **applies to: all items / specific categories / specific items** (load
categories from `/api/categories` and items from `/api/menu`, both already exist); unique-code
toggle. Submit → shows `created` count and sample codes, with a "Copy all" and a link to the
Offers page. A **Campaigns** tab lists past batches with a deactivate action.

---

## 6. Things that must NOT change

- Existing `/api/customers` GET response shapes (`/`, `/top`, `/inactive`, `/analytics`) —
  the current page and any other consumer depend on them.
- `Order` schema fields other than the one added `customerId`.
- The QR token validation flow (`publicOrderToken`, `assertValidTableQrToken`) and
  `client/app/components/tables/TableQR.js`.
- The loyalty points / reward-coupon logic in `_handleCustomerCRM` — extend around it,
  don't replace it.
- `pageAccess.js` page keys, `routes.js` paths, sidebar/nav structure.
- Any role's landing path or the layout access guard.

---

## 7. Acceptance checklist

**Identity & membership**
- [ ] One phone = one `Customer` document, across every cafe.
- [ ] Migration merges existing duplicates without losing visits/spend/points; `--dry-run` works; re-running is a no-op.
- [ ] A customer who orders at Cafe A and Cafe B has two `memberships`, each with its own status.
- [ ] Status flips `new → existing` **only** on the first COMPLETED order in that cafe, exactly once, even under concurrent completes.

**QR flow**
- [ ] First scan at a cafe → form appears with name/mobile/gender/dob/email.
- [ ] Skip works; no ghost Customer row is created.
- [ ] After submitting once, **no further scan ever re-asks** — the greeting bar appears instead.
- [ ] Edit works for name/phone/gender/email; **DOB is rejected server-side once set** (not just hidden in the UI).
- [ ] The new-customer discount lands on the order total and is computed by the server, not the browser.
- [ ] No endpoint returns a profile in response to a bare phone number.

**POS**
- [ ] Staff cannot send an order to the kitchen without name **and** a valid 10-digit phone.
- [ ] Cash/UPI is chosen at order creation and flows through to billing.
- [ ] A POS order populates `Order.customerPhone` and `Order.customerId`.

**CRM page**
- [ ] super_admin sees every cafe; admin only their cafes; branch_admin/location_admin only their branches — verified by hitting the API directly with each role's token, not just by hiding UI.
- [ ] Date filter behaves identically to the Overview page.
- [ ] New / repeat / returning counts are correct for a hand-built fixture.
- [ ] Per-customer drawer shows orders with its own independent date filter.
- [ ] Birthday campaign generates coupons only for in-scope customers; codes are unique; a generated coupon is rejected at `applyCoupon` for a different cafe or a different customer.
- [ ] Discount config respects the `DEFAULTS < global < cafe < branch` chain and the per-role write authorisation.

**Regression**
- [ ] Existing loyalty reward coupons still mint at the threshold.
- [ ] `/api/customers/top`, `/inactive`, `/analytics` return the same shape as before.
- [ ] Completing an order still succeeds even if every CRM write throws.

---

## 8. Suggested build order

1. `Customer` model + migration + `startupMigrations` hook (dry-run first, on a DB copy).
2. `Settings` cafe tier + `crm` group + `getSettings` chain.
3. `_handleCustomerCRM` rewrite (membership upsert + one-shot discount claim) + `Order.customerId`.
4. Public customer endpoints + `customerToken` HMAC + `createPublicOrder` discount.
5. `client/app/order/page.js` first-visit sheet / greeting bar / edit.
6. POS: phone required + payment-at-order (`AssignTableModal` → tables pages → `tableController`).
7. Authenticated CRM endpoints (`/report`, `/summary`, `/:id`, `/:id/orders`, `PATCH`).
8. Customers page rebuild (filters → KPIs → table → drawer).
9. Coupon scoping + audience + birthday campaign endpoint + modal.
10. Action permissions, export, audit logging.

Each step should be independently shippable and must leave the app green.
