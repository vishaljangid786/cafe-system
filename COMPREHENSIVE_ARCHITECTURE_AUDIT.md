# CAFEOS — COMPREHENSIVE ARCHITECTURE AUDIT REPORT
**Auditor**: Senior Enterprise Software Architect  
**Date**: May 11, 2026  
**Stack**: Next.js 15 App Router · React 19 · Express.js · MongoDB · Socket.io · TailwindCSS · JWT

---

## SCORECARD

| Dimension | Score | Grade |
|:---|:---:|:---:|
| **Architecture** | 64/100 | C+ |
| **Scalability** | 58/100 | C |
| **Maintainability** | 55/100 | C- |
| **Security** | 70/100 | B- |

**Overall System Health**: `61/100` — Functional, but critical refactoring required before enterprise scale.

---

## EXECUTIVE SUMMARY

CafeOS is a well-intentioned, feature-rich multi-branch cafe management platform that has been built at speed. The core business logic (OMS state machine, RBAC, location scoping) is conceptually sound. However, the codebase has developed several critical anti-patterns — primarily **god-object controllers**, **duplicated schema logic**, **tightly coupled cross-layer calls**, and **frontend mega-components** — that will cause significant pain at scale.

The security posture is decent (httpOnly cookies, role-based guards) but has gaps. The socket architecture is functional but lacks event namespacing and room lifecycle management.

---

## PART 1: BACKEND ARCHITECTURE

### 1.1 God-Object Controllers

| Severity | `CRITICAL` |
|:---|:---|
| **Affected Files** | `analyticsController.js` (1,677 lines, 55KB), `orderController.js` (1,261 lines, 40KB) |

These are the two most severe anti-patterns in the codebase. A single controller file is doing the work of 4–6 dedicated service modules.

**`analyticsController.js` contains:**
- `getLocationAnalytics` — location-specific metrics
- `getAllAnalytics` — global aggregation
- `compareLocations` — multi-branch comparison
- `getAdvancedAnalytics` — 400-line function with 8+ separate MongoDB aggregations, forecasting, payroll, attendance, payment intelligence all in one function
- `getLocationComparison`, `getTopLocations`, `getTrendingItems` — each a full analytics engine

**`orderController.js` contains:**
- CRUD operations
- Stock deduction logic
- Notification dispatch
- Financial transaction creation (via `orderFinalizer.js`)
- Chef statistics
- Staff statistics
- Bill generation
- Force-complete administrative override

**Fix — Decompose into service layer:**
```
server/
  services/
    orderService.js          # Order CRUD + stock deduction
    orderFinancialService.js # Transaction creation, profit calc
    analyticsAggregator.js   # Raw MongoDB pipelines
    forecastService.js       # Smart forecasting logic
    reportService.js         # Report-specific aggregations
  controllers/
    orderController.js       # Thin: delegates to services
    analyticsController.js   # Thin: delegates to aggregator
```

---

### 1.2 Duplicated Inventory Schema

| Severity | `HIGH` |
|:---|:---|
| **Affected Files** | `models/BranchInventory.js`, `models/BranchStock.js` |

The system has **two separate inventory collections** serving different purposes without a clear boundary:

- `BranchInventory` — tracks **ingredient** stock per branch (raw materials).
- `BranchStock` — tracks **menu item** availability per branch (POS readiness).

This is not necessarily wrong, but it creates confusion because:
1. There is no document linking the two schemas.
2. The `inventoryController.js` and `orderController.js` reference them independently with no shared abstraction.
3. Naming is inconsistent: one uses `branch` as the field name, both reference `Location` but with different semantics.

**Fix:**
- Add a `type` discriminator to a single `BranchInventory` collection, OR
- Document the distinction clearly and add a `menuItem` ↔ `ingredient` relationship via `Recipe` to enforce the chain.
- Standardize field naming: both should use `locationId` to be consistent with `Transaction`, `Expense`, and `Attendance` models.

---

### 1.3 Business Logic in a Route File

| Severity | `HIGH` |
|:---|:---|
| **Affected File** | `routes/exportRoutes.js` (194 lines) |

`exportRoutes.js` contains a full 170-line `switch` statement with direct model queries, data transformation, and file generation — all inside a route handler. This is a direct violation of the Controller-Service separation pattern used in the rest of the app.

**Fix:** Extract to `controllers/exportController.js` and `services/exportService.js`.

```javascript
// exportRoutes.js — correct pattern
router.get('/', verifyToken, authorizePermissions('exportReports'), exportData);

// exportController.js
const exportData = asyncHandler(async (req, res) => {
  const data = await ExportService.getExportData(req);
  return ExportService.streamFile(res, data, req.query.format);
});
```

---

### 1.4 Cross-Layer Coupling — Controller importing Controller

| Severity | `HIGH` |
|:---|:---|
| **Affected File** | `utils/orderFinalizer.js` (line 3) |

```javascript
// ANTI-PATTERN: A utility importing from a controller
const { deductIngredientsFromRecipe } = require('../controllers/inventoryController');
```

This creates a **circular dependency risk** and breaks the single-responsibility principle. Controllers should not be importable by utilities. The function `deductIngredientsFromRecipe` should be in an `inventoryService.js` or `recipeService.js`, not inside a controller.

**Fix:** Move `deductIngredientsFromRecipe` to `services/inventoryService.js`.

---

### 1.5 OMS Middleware Doing Double Duty

| Severity | `MEDIUM` |
|:---|:---|
| **Affected File** | `middlewares/omsMiddleware.js` |

The `validateOrderTransition` middleware:
1. Validates state transitions (correct middleware concern)
2. **Performs a DB query** (`Order.findById(id)`)
3. **Enforces location access** (duplicates logic from authMiddleware)
4. **Attaches order to `req.omsOrder`** (side-effect coupling)

The DB query in the middleware means every transition endpoint does **2 DB reads for the order** — once in middleware and once in the controller.

**Fix:** Pass `req.omsOrder` through and have controllers use it exclusively, eliminating the second fetch. Consider making this a route-level guard rather than a general middleware.

---

### 1.6 Revenue Aggregation Fragmentation

| Severity | `HIGH` |
|:---|:---|
| **Affected Files** | `analyticsController.js` (lines 54–70, 117–155) |

Revenue is aggregated from **three separate sources** with no unified pipeline:
1. `Table.aggregate()` for revenue (using `totalAmount` on the `Table` model)
2. `Expense.aggregate()` for expenses
3. `Transaction.aggregate()` for transaction expenses

The `Transaction` model is the **correct** source of truth for all financial records, but `getLocationAnalytics` and `getAllAnalytics` still query the `Table` model for revenue. This creates **data discrepancy risk** — especially since the `Table` model's `totalAmount` may not match finalized `Transaction` records.

**Fix:** Remove all revenue queries from `Table`. Revenue must exclusively come from `Transaction` where `type !== 'EXPENSE'`.

---

### 1.7 Input Validation Coverage Gaps

| Severity | `MEDIUM` |
|:---|:---|
| **Affected Files** | `routes/orderRoutes.js`, `routes/tableRoutes.js`, `routes/notificationRoutes.js` |

The `validateMiddleware.js` defines schemas for: login, signup, menuItem, location, booking, coupon.  
However, **order creation, table updates, and notifications have NO `express-validator` schemas**. Order payload validation is done ad-hoc inside `orderController.js` using manual checks, missing field types and range validation.

**Fix:** Add `orderCreateSchema` and `tableUpdateSchema` in `validateMiddleware.js`.

---

### 1.8 Scheduler Missing Error Isolation

| Severity | `LOW` |
|:---|:---|
| **Affected File** | `utils/scheduler.js` |

Cron jobs that fail silently will cause revenue/report data to drift. Each scheduled job needs try/catch with alerting.

---

## PART 2: FRONTEND ARCHITECTURE

### 2.1 Mega-Component: `AdminOrdersDashboard` (761 lines)

| Severity | `CRITICAL` |
|:---|:---|
| **Affected File** | `client/app/dashboard/admin/orders/page.js` |

This single component contains:
- 10+ `useState` hooks
- Data fetching logic (3 simultaneous API calls)
- Filter/search state
- Pagination logic
- Analytics chart rendering
- Critical Watchlist with modal
- Full table/grid rendering of orders
- Order detail modal
- Watchlist modal
- `AdminOrderCard` component defined inline at the bottom of the file
- Socket.io connection created **a second time** (line 4: `const SOCKET_URL = ...` + `io(...)`) despite one already existing in `AuthContext`

**Fix — Decompose into:**
```
app/dashboard/admin/orders/
  page.js                    # Shell: composes panels
  hooks/
    useOrderData.js          # fetchData, pagination, socket sync
    useOrderFilters.js       # branch/status/date/search filters
  components/
    OrderMatrixTable.jsx     # List view
    OrderCard.jsx            # Grid card
    OrderDetailModal.jsx     # Dossier slide-in
    CriticalWatchlist.jsx    # Watchlist panel + modal
    OrderMetricsBar.jsx      # KPI metrics row
    KitchenEfficiencyChart.jsx
```

---

### 2.2 Duplicate Socket Connection

| Severity | `HIGH` |
|:---|:---|
| **Affected File** | `client/app/dashboard/admin/orders/page.js` (line 4) |

```javascript
// ANTI-PATTERN: page.js creates its OWN socket connection
import { io } from 'socket.io-client';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
```

The `AuthContext` already creates and manages a socket connection. Individual pages creating their own socket connections means **N+1 socket connections per authenticated user**, causing:
- Doubled server load
- Duplicate event handlers
- Race conditions between socket updates

**Fix:** Expose the socket from `AuthContext` and consume it: `const { socket } = useAuth();`

---

### 2.3 AuthContext Over-Responsibility

| Severity | `HIGH` |
|:---|:---|
| **Affected File** | `client/app/context/AuthContext.js` |

The single `AuthContext` manages:
- User authentication state
- Global location list (`locations`, `fetchLocations`)
- Socket.io connection lifecycle
- Global search state (`globalSearch`, `setGlobalSearch`)
- Impersonation flow
- Cookie persistence

This violates single responsibility. The `locations` state and `fetchLocations` belong in a `LocationContext` or `useLocations` hook. The global socket should be in a `SocketContext`. The global search state is unrelated to authentication.

**Fix:**
```javascriptn
// Split into:
AuthContext.js       // user, login, logout, impersonate
SocketContext.js     // socket lifecycle, rooms
LocationContext.js   // locations, selectedLocation, switchLocation
```

---

### 2.4 User Data Duplicated in Cookies

| Severity | `HIGH` |
|:---|:---|
| **Affected File** | `client/app/context/AuthContext.js` (lines 65, 130, 193) |

```javascript
// User object stored in readable cookie — NOT httpOnly
Cookies.set('user', JSON.stringify(userData), { expires: 7 });
```

The full user object (including role, permissions, accessibleLocations) is stored in a **non-httpOnly, non-Secure cookie**. This means:
- Any JS on the page can read `Cookies.get('user')` and extract roles/permissions
- A XSS attack can exfiltrate the full user profile
- Client-side role checks (e.g., `user?.role === 'admin'`) become a trust boundary issue

The JWT auth cookie is presumably httpOnly (managed by the server). The user object cookie is redundant — it should be fetched on mount via `/auth/profile` only, not persisted in a readable cookie.

**Fix:** Remove `Cookies.set('user', ...)` everywhere. On app load, call `/auth/profile` to hydrate user state. Use a short-lived in-memory state.

---

### 2.5 Location Fetched Without Authentication Check

| Severity | `MEDIUM` |
|:---|:---|
| **Affected File** | `client/app/context/AuthContext.js` (line 102) |

```javascript
useEffect(() => {
  checkAuth();
  fetchLocations(); // ← runs regardless of auth state
}, []);
```

`fetchLocations` fires unconditionally on mount, even for unauthenticated users (e.g., on the login page). This causes the "Failed to load global locations" console error seen in production. Locations should only be fetched after a successful `checkAuth`.

**Fix:**
```javascript
const checkAuth = async () => {
  const userData = await ...; // verify session
  if (userData) {
    await fetchLocations(); // only if authenticated
    initializeSocket(userData);
  }
};
```

---

### 2.6 Role-Based Routing is Duplicated in 3 Places

| Severity | `MEDIUM` |
|:---|:---|
| **Affected Files** | `AuthContext.js` (login fn), `AuthContext.js` (impersonate fn), `AuthContext.js` (exitImpersonation fn) |

The role→route mapping:
```javascript
if (role === 'super_admin' || role === 'admin') router.push('/dashboard/admin');
else if (role === 'branch_admin') router.push('/dashboard/branch-admin');
...
```
appears verbatim **3 times** in `AuthContext.js` (login, impersonate, exitImpersonation).

**Fix:**
```javascript
// utils/getRoleDashboard.js
export const getRoleDashboard = (role) => {
  const map = {
    super_admin: '/dashboard/admin',
    admin: '/dashboard/admin',
    branch_admin: '/dashboard/branch-admin',
    chef: '/dashboard/chef',
    staff: '/dashboard/staff',
  };
  return map[role] || '/dashboard/staff';
};
```

---

## PART 3: RBAC STRUCTURAL ISSUES

### 3.1 Implicit Permission Override in Middleware

| Severity | `HIGH` |
|:---|:---|
| **Affected File** | `middlewares/authMiddleware.js` (lines 82–85) |

```javascript
// Implicit override bypasses the permissions system
const isOperationalOverride = permissions.some(p =>
  ['manageOrders', 'forceComplete', 'viewOrders'].includes(p)
);
const isRestrictedRole = ['admin', 'branch_admin'].includes(req.user.role);
const hasPermission = (isOperationalOverride && isRestrictedRole) || permissions.every(p => userPermissions[p]);
```

This means `admin` and `branch_admin` users **always** have `manageOrders`, `forceComplete`, and `viewOrders` regardless of their `permissions` object in the database. This effectively makes the granular `permissions` system a no-op for admin-level roles, undermining the principle of least privilege.

**Fix:** Either fully embrace role-based access (remove fine-grained permissions for these roles), or properly seed default permissions for admin roles in the User model/seed data. Do not use implicit runtime overrides.

---

### 3.2 `location_admin` Role is Orphaned

| Severity | `MEDIUM` |
|:---|:---|
| **Affected Files** | `models/User.js` (enum), `client/app/dashboard/location-admin/` |

The `location_admin` role exists in the User schema enum and has a dashboard directory, but:
- It is **never referenced** in `authMiddleware.js`
- It is **never referenced** in `omsMiddleware.js` ROLE_PERMISSIONS
- The `authorizeRoles` calls in routes do not include it
- The `canAccessLocation` utility treats it the same as a regular user

This is dead role infrastructure. Either fully implement it or remove it.

---

### 3.3 `staff` Role Can Cancel Orders via `ROLE_PERMISSIONS` Gap

| Severity | `MEDIUM` |
|:---|:---|
| **Affected File** | `middlewares/omsMiddleware.js` (line 27) |

```javascript
'CANCELLED': ['admin', 'super_admin', 'branch_admin']
```

Staff cannot cancel via OMS, which is correct. However, the `manageOrders` permission used in `authorizePermissions` for `PATCH /:id/cancel` is granted to staff by default if they have the permission flag set. A staff member with `manageOrders: true` can call `/cancel` and will be authorized at the permission level, then correctly rejected at the OMS level — but this is a defense-in-depth gap. The route-level guard should also restrict cancel to admin roles.

---

## PART 4: MONGODB SCHEMA DESIGN

### 4.1 Transaction Schema Has Conditional Required Fields

| Severity | `MEDIUM` |
|:---|:---|
| **Affected File** | `models/Transaction.js` |

```javascript
title: { required: function() { return this.type !== 'POS_REVENUE'; } },
category: { required: function() { return this.type !== 'POS_REVENUE'; } },
tableNumber: { required: function() { return this.type === 'POS_REVENUE'; } },
staffId: { required: function() { return this.type === 'POS_REVENUE'; } },
```

Conditional `required` functions are fragile and untestable. They create invisible validation rules that only fail at runtime. MongoDB discriminators or subdocument unions are the correct approach for polymorphic schemas.

**Fix:** Use Mongoose discriminators to define `RevenueTransaction` and `ExpenseTransaction` sub-models.

---

### 4.2 `Expense` and `Transaction (type: EXPENSE)` Are Redundant

| Severity | `HIGH` |
|:---|:---|
| **Affected Files** | `models/Expense.js`, `models/Transaction.js`, `analyticsController.js` |

Every analytics function queries **both** the `Expense` collection and `Transaction WHERE type = EXPENSE`:
```javascript
const expenseAgg = await Expense.aggregate([...]);           // Source 1
const transactionExpenseAgg = await Transaction.aggregate([...]); // Source 2
// Then manually merges them
```

This means there are **two sources of truth for expenses**. When analytics fails to merge them correctly, totals diverge. This is the likely root cause of any revenue/profit discrepancies in the dashboard.

**Fix:** Migrate all manual expenses to create a `Transaction` record (type: `EXPENSE`). Archive the `Expense` model. Consolidate all financial queries to a single `Transaction` collection.

---

### 4.3 `Order.statusHistory` Has No Index

| Severity | `LOW` |
|:---|:---|
| **Affected File** | `models/Order.js` |

`statusHistory` is a subdocument array that grows with each status change. If orders are ever queried by a specific status history timestamp (e.g., "time from PLACED to READY"), there is no supporting index. This will degrade as order volume grows.

---

### 4.4 User Model Stores PII in Plaintext

| Severity | `MEDIUM` |
|:---|:---|
| **Affected File** | `models/User.js` |

Fields `aadharNumber`, `phone`, `address1`, `address2` store sensitive personally identifiable information (PII) as **plaintext strings** in MongoDB. For a production system handling employee data, these should be encrypted at rest or at the application layer.

---

## PART 5: SOCKET ARCHITECTURE

### 5.1 No Socket Event Namespacing

| Severity | `MEDIUM` |
|:---|:---|
| **Affected File** | `server.js`, `config/socket.js` |

All socket events (`join_session`, `join_room`, `new_notification`, order updates) share the **default `/` namespace**. In a multi-role system, namespace separation prevents event cross-contamination:
- `/kitchen` — chef order events
- `/admin` — admin alert events
- `/notifications` — notification broadcast

**Fix:** Implement Socket.io namespaces:
```javascript
const kitchenNS = io.of('/kitchen');
const adminNS = io.of('/admin');
```

---

### 5.2 Socket Room Joins Are Client-Controlled

| Severity | `MEDIUM` |
|:---|:---|
| **Affected File** | `server.js` (lines 60–76) |

```javascript
socket.on('join_session', ({ branchId } = {}) => {
  socket.join(`branch_${branchId}`);
});
```

While `canAccessLocation` guards the join, the client is still driving room membership by sending events. In an enterprise system, **room assignment should be fully server-controlled** at connection time, not driven by client events.

**Fix:** Assign rooms entirely in the `io.on('connection')` handler based on the authenticated `socket.user`. Remove client-driven `join_session` events.

---

### 5.3 `sendNotification` Makes a User Query on Every Event

| Severity | `MEDIUM` |
|:---|:---|
| **Affected File** | `utils/sendNotification.js` (line 31) |

```javascript
const users = await User.find(query); // Full DB query per notification
```

Every notification dispatch fetches all users matching the role query. In a system with hundreds of staff members, this becomes expensive at high order volume. 

**Fix:** Use Socket.io rooms instead. Emit to `role_admin`, `role_super_admin` rooms directly. Roles are already assigned to rooms in `server.js`. Eliminate the `User.find` query entirely.

---

## PART 6: NAMING INCONSISTENCIES

| Issue | Example | Fix |
|:---|:---|:---|
| Location field named `branch` in Order but `locationId` in Transaction | `Order.branch` vs `Transaction.locationId` | Standardize to `locationId` across all models |
| Controller uses `==` (loose equality) for role check | `orderController.js:19` `req.user.role == 'chef'` | Use `===` everywhere |
| Dashboard route uses kebab-case but role uses underscore | `/dashboard/branch-admin` vs `role: 'branch_admin'` | Document the intentional difference |
| `BranchInventory` vs `BranchStock` — both are "branch inventory" | Two models, different purposes | Rename to `BranchIngredientStock` and `BranchMenuStock` |
| `getMyChefStats` vs `getMyStaffStats` — inconsistent prefix | Suggests personal stats but unclear | Rename to `getChefPersonalMetrics`, `getStaffPersonalMetrics` |

---

## PART 7: DEAD CODE / UNUSED FILES

| File | Status |
|:---|:---|
| `server/check_attendance.js` | Debug script — remove from production repo |
| `server/check_user.js` | Debug script — remove |
| `server/get_ids.js` | Debug script — remove |
| `server/get_token.js` | Debug script — remove |
| `server/get_users.js` | Debug script — remove |
| `server/test_login.js` | Debug script — remove |
| `server/seed_attendance.js` | Seed script — move to `/seed/` folder |
| `server/seed_data_task.js` | Seed script — move to `/seed/` folder |
| `server/seed_orders.js` | Seed script — move to `/seed/` folder |
| `client/app/scratch/` | Development scratch directory — remove |
| `client/lint_output*.txt` (5 files) | Lint artifacts — add to `.gitignore`, remove |
| `claudefindings.md`, `workspace-audit-report.md` | Stale AI artifacts — clean up |

---

## PART 8: SCALABILITY BOTTLENECKS

### 8.1 `getAdvancedAnalytics` — 8 Sequential Aggregations

| Severity | `HIGH` |
|:---|:---|
| **Affected File** | `analyticsController.js` |

The `getAdvancedAnalytics` function runs 8+ MongoDB aggregations sequentially (some awaited one after another). Under load, this function can take 5–15 seconds for large datasets.

**Fix:**
```javascript
// Run independent aggregations in parallel
const [transactionAgg, expenseAgg, manualExpenseAgg, payrollAgg, attendanceAgg] = 
  await Promise.all([...]);
```

---

### 8.2 Forecasting Loads All Orders Into Node.js Memory

| Severity | `HIGH` |
|:---|:---|
| **Affected File** | `analyticsController.js` (lines 469–479) |

```javascript
// Fetches ALL orders for 90 days into memory
const forecastOrders = await Order.find({ ... }).select('totalAmount createdAt').lean();
forecastOrders.forEach(order => { ... }); // In-memory iteration
```

At 1,000+ orders/day × 90 days = 90,000 documents loaded into Node.js memory for every analytics page load. This will cause memory spikes and OOM crashes at scale.

**Fix:** Move the day-of-week aggregation to MongoDB:
```javascript
const forecastAgg = await Order.aggregate([
  { $match: { ... } },
  { $group: { _id: { $dayOfWeek: '$createdAt' }, totalSales: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
]);
```

---

### 8.3 No Caching Layer

| Severity | `HIGH` |
|:---|:---|
| **Affected Files** | All analytics endpoints |

Analytics endpoints re-run complex aggregations on every request with no caching. At 20+ concurrent users viewing dashboards, this creates a sustained aggregation storm on MongoDB.

**Fix:** Add Redis caching for analytics results with a 60-second TTL:
```javascript
const cached = await redis.get(cacheKey);
if (cached) return res.json(JSON.parse(cached));
// ... run aggregation
await redis.setEx(cacheKey, 60, JSON.stringify(result));
```

---

### 8.4 No Database Connection Pooling Configuration

| Severity | `MEDIUM` |
|:---|:---|
| **Affected File** | `config/db.js` |

`mongoose.connect()` is called with no pooling options. The default pool size (5 connections) is insufficient for a multi-branch system under concurrent load.

**Fix:**
```javascript
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
});
```

---

## PART 9: RECOMMENDED TARGET ARCHITECTURE

```
cafe-system/
├── server/
│   ├── config/
│   │   ├── db.js
│   │   ├── redis.js          [NEW] Cache layer
│   │   └── socket.js
│   ├── controllers/          [THIN — delegate to services]
│   │   ├── orderController.js
│   │   ├── analyticsController.js
│   │   └── ...
│   ├── services/             [NEW — business logic layer]
│   │   ├── orderService.js
│   │   ├── inventoryService.js
│   │   ├── analyticsService.js
│   │   ├── forecastService.js
│   │   └── notificationService.js
│   ├── repositories/         [NEW — data access layer]
│   │   ├── orderRepository.js
│   │   └── transactionRepository.js
│   ├── middlewares/
│   ├── models/
│   └── routes/
└── client/
    ├── app/
    │   ├── dashboard/
    │   │   └── admin/orders/
    │   │       ├── page.js              [THIN shell]
    │   │       ├── hooks/
    │   │       │   ├── useOrderData.js
    │   │       │   └── useOrderFilters.js
    │   │       └── components/
    │   │           ├── OrderCard.jsx
    │   │           ├── OrderTable.jsx
    │   │           └── OrderDetailModal.jsx
    │   ├── context/
    │   │   ├── AuthContext.js          [auth only]
    │   │   ├── SocketContext.js        [NEW]
    │   │   └── LocationContext.js      [NEW]
    │   └── utils/
    │       └── getRoleDashboard.js    [NEW]
```

---

## REFACTOR PRIORITY MATRIX

| Priority | Issue | Effort | Impact |
|:---:|:---|:---:|:---:|
| P0 | Fix `fetchLocations` running on unauthenticated mount (causes console errors) | Low | High |
| P0 | Remove duplicate socket connections in page components | Low | High |
| P1 | Decompose `getAdvancedAnalytics` — parallelize aggregations | Medium | High |
| P1 | Move forecast from in-memory to MongoDB aggregation | Medium | High |
| P1 | Move `deductIngredientsFromRecipe` out of controller into service | Low | Medium |
| P1 | Remove user object from readable cookie | Low | High |
| P2 | Extract export logic from route file into controller | Medium | Medium |
| P2 | Unify `Expense` + `Transaction(EXPENSE)` into single source of truth | High | High |
| P2 | Standardize `branch` field name to `locationId` across all models | High | Medium |
| P2 | Extract `AdminOrdersDashboard` into composable components | High | High |
| P3 | Add Redis caching for analytics endpoints | High | High |
| P3 | Implement Socket.io namespaces | Medium | Medium |
| P3 | Remove dead debug scripts from server root | Low | Low |
| P3 | Encrypt PII fields in User model | High | High |
| P4 | Remove `location_admin` role or fully implement it | Medium | Low |
| P4 | Configure MongoDB connection pool | Low | Medium |

---

*This audit was generated from a recursive analysis of all source files in `server/controllers/`, `server/models/`, `server/middlewares/`, `server/utils/`, `server/routes/`, `server/config/`, and `client/app/`. Scoring reflects a production-readiness benchmark for a multi-tenant SaaS application.*

---

## AUDIT UPDATE — MAY 11, 2026 (POST-AUDIT REVIEW)

A follow-up review was conducted to verify which of the previously identified architectural issues and bugs have been addressed.

### SUMMARY OF PROGRESS

| Status | Count | items |
|:---|:---:|:---|
| **FIXED** | 13 | 1.1, 1.3, 1.4, 1.6, 1.8, 2.1, 2.2, 2.5, 2.6, 4.2, 8.1, 8.2, 8.4 |
| **PARTIALLY FIXED** | 1 | 1.5 |
| **STILL UNFIXED** | 14 | 1.2, 1.7, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.3, 4.4, 5.1, 5.2, 5.3, 8.3 |

---

### DETAILED STATUS REPORT

#### PART 1: BACKEND ARCHITECTURE
- [x] **1.1 God-Object Controllers**: **FIXED**. `analyticsController.js` and `orderController.js` have been refactored. Business logic moved to `AnalyticsService` and `OrderService`.
- [ ] **1.2 Duplicated Inventory Schema**: `BranchInventory` and `BranchStock` still exist as separate models.
- [x] **1.3 Business Logic in Route File**: **FIXED**. Export logic moved from `exportRoutes.js` to `exportController.js`.
- [x] **1.4 Cross-Layer Coupling**: **FIXED**. `utils/orderFinalizer.js` now imports from `services/inventoryService` instead of a controller.
- [/] **1.5 OMS Middleware Double Duty**: **PARTIALLY FIXED**. `req.omsOrder` is used in some places, but duplicate location checks remain.
- [x] **1.6 Revenue Aggregation Fragmentation**: **FIXED**. Centralized in `AnalyticsService` and `Transaction` model.
- [ ] **1.7 Input Validation Gaps**: **STILL MISSING**. No `express-validator` schemas for order creation or table updates.
- [x] **1.8 Scheduler Error Isolation**: **FIXED**. Basic try/catch logic added to `utils/scheduler.js`.

#### PART 2: FRONTEND ARCHITECTURE
- [x] **2.1 Mega-Component**: **FIXED**. `AdminOrdersDashboard` has been broken down into modular components in `dashboard/admin/orders/components/`.
- [x] **2.2 Duplicate Socket Connection**: **FIXED**. The component now reuses the socket from `AuthContext`.
- [ ] **2.3 AuthContext Over-Responsibility**: Still manages locations, socket lifecycle, and global search.
- [/] **2.4 User Data in Cookies**: **MOSTLY FIXED**. `Cookies.set('user', ...)` has been removed, although the initialization logic still looks for it.
- [x] **2.5 Location Fetched Without Auth Check**: **FIXED**. Fetching is now deferred until after `checkAuth` succeeds.
- [x] **2.6 Role-Based Routing Duplication**: **FIXED**. Centralized in `getRoleDashboard` helper.

#### PART 3: RBAC STRUCTURAL ISSUES
- [ ] **3.1 Implicit Permission Override**: Hardcoded overrides for `admin`/`branch_admin` still exist in `authMiddleware.js`.
- [ ] **3.2 `location_admin` Role Orphaned**: Role remains in schema but unimplemented in middleware and routes.
- [ ] **3.3 `staff` Role Cancel Gap**: Route-level guards still rely on permissions that might be over-granted to staff.

#### PART 4: MONGODB SCHEMA DESIGN
- [ ] **4.1 Transaction Schema Conditional Fields**: Fragile `required` functions still present in `Transaction.js`.
- [x] **4.2 Expense Redundancy**: **FIXED**. `Expense` and `Transaction (type: EXPENSE)` are now unified via `TransactionService` and automated syncing.
- [ ] **4.3 Order statusHistory Index**: Missing index on the status history array.
- [ ] **4.4 PII Plaintext**: Sensitive employee data is still not encrypted at rest.

#### PART 5: SOCKET ARCHITECTURE
- [ ] **5.1 No Socket Event Namespacing**: All events still share the default namespace.
- [ ] **5.2 Client-Controlled Joins**: Clients can still trigger room joins via `join_session` events.
- [ ] **5.3 sendNotification User Query**: Still performs a `User.find` query on every notification dispatch.

#### PART 8: SCALABILITY
- [x] **8.1 Parallelization**: **FIXED**. `AnalyticsService` now uses `Promise.all` for all major data aggregations.
- [x] **8.2 Forecasting Memory Usage**: **FIXED**. Now uses MongoDB aggregation pipelines.
- [ ] **8.3 No Caching Layer**: Redis caching for analytics is still not implemented.
- [x] **8.4 DB Connection Pooling**: **FIXED**. Connection options in `config/db.js` now include pool size configurations.

---
**Reviewer Note**: Significant progress has been made on the "Low-Hanging Fruit" (socket duplication, role-based routing), but the core architectural debt (God-Objects, Service Layer, Schema Redundancy) remains the highest priority for the next phase.
