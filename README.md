# ☕ Cafe OS — Advanced Multi-Branch Management Suite

> A cinematic, high-fidelity cafe management platform engineered for modern hospitality chains. Unified command-and-control for branches, personnel, culinary inventory, fiscal analytics, and real-time operational diagnostics.

---

## 🚀 Recent Core Updates

### 🍳 High-Performance Order Management System (OMS)
A ground-up implementation of a real-time kitchen lifecycle management system.
- **State Machine Architecture**: Orders flow through a strict protocol: `PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED`, with administrative `CANCEL` and kitchen `REJECT` overrides.
- **Chef Command Deck**: A specialized real-time dashboard for kitchen staff to manage throughput, attach delay notes, and trigger "Ready for Service" notifications.
- **Staff Live Monitor**: Floor staff can now track order progress in real-time, receiving instant toasts when orders are ready for pick-up.
- **Administrative Oversight**: Global and Location admins have gained "Force Complete" capabilities and universal cancellation authority to resolve operational bottlenecks.

### 📊 Deep-Dive Operational Analytics
- **Efficiency Mapping**: Real-time calculation of **Average Preparation Time** (measured from acceptance to readiness).
- **Culinary Throughput Ranking**: Automated leaderboard ranking chefs based on service speed and order volume.
- **Temporal Volume Mapping**: Hourly distribution charts to identify branch-specific peak hours.
- **Delay Surveillance**: An automated "Watchlist" that flags orders exceeding critical service thresholds (e.g., >20 minutes).

### 👨‍🍳 Enhanced Personnel Intelligence
- **Personalized Chef Dashboards**: Kitchen staff can now access their own performance metrics, salary history (compensation ledger), and attendance matrix directly from their profile.
- **Automatic Floor Sync**: Table statuses are now intelligently synchronized with the order lifecycle. A table is automatically marked `available` only when 100% of its active orders are `SERVED`.

### 🛡️ Operational Integrity & Dietary Intelligence
Recent stability upgrades to the Command Deck dashboards:
- **Debounced Identity Sync**: Implemented a high-precision debouncing protocol (800ms) for guest identity inputs. This eliminates "cursor jumping" and input lag by prioritizing local state during rapid typing before synchronizing with the server.
- **Dietary Categorization System**: Full integration of `Veg` / `Non-Veg` filters across all Menu and Table management modules. Filters dynamically appear only when the branch inventory contains both dietary types.
- **Transactional Lock Protocol**: A defensive state mechanism that "locks" the active order registry once a coupon is applied. This prevents fiscal inconsistencies by ensuring the order remains immutable until the coupon is removed or the session is finalized.
- **Strict Archival Validation**: Mandatory checks ensure sessions contain at least one valid menu item before allowing bill finalization or coupon application, protecting the transactional ledger from empty entries.

---

## 👥 Role Hierarchy & Access Control

| Role | Responsibility | Key Pages Access |
|---|---|---|
| **Super Admin** | Global Oversight | Full System Access, Global Personnel, Global Analytics |
| **Admin** | Chain Management | Branch Comparison, Order Matrix, Global Analytics, Chain-wide Salaries |
| **Location Admin**| Branch Operations | Branch Tables, Order Oversight, Local Staff, Attendance, Local Expenses |
| **Chef** | Culinary Execution | **Kitchen Command Deck**, Personal Performance Stats, Menu Reference |
| **Staff** | Daily Execution | Floor Map, **Live Order Creation**, Pickup Notifications, Personal Attendance |

---

## 📁 System Architecture: Frontend Pages

### 👑 Administration (`/dashboard/admin`)
- **Operational Oversight (`/orders`)**: Cross-branch surveillance of all active orders with override controls.
- **Intelligence Dashboard (`/orders/analytics`)**: Deep-dive metrics into kitchen efficiency, peak hours, and chef rankings.
- **Branch Management (`/locations`)**: Create and manage branch status (Active, Hold, Deactivated).
- **Personnel Hub (`/users`, `/staff`)**: Global directory with hierarchy management and salary oversight.

### 👨‍🍳 Kitchen Command (`/dashboard/chef`)
- **Kitchen Deck**: Real-time lane management for orders (Incoming, Preparing, Fulfillment).
- **Status Control**: Interactive toggles for `ACCEPT`, `START PREP`, and `MARK READY`.
- **Communication**: Attach "Chef Notes" to orders for floor staff visibility.

### 🏃 Frontline Operations (`/dashboard/staff`)
- **Live Orders (`/orders`)**: Create and track orders through the culinary lifecycle.
- **Floor Map (`/tables`)**: Primary interface for table booking and session management.
- **Time Log (`/attendance`)**: Personal attendance clock-in/out protocol.

---

## 📡 API Architecture & Routing

### 🔋 Active API Routes (`/server/routes`)

| Route | Endpoint Prefix | Purpose |
|---|---|---|
| **Orders (OMS)** | `/api/orders` | Full order lifecycle, status history, and operational analytics |
| **Authentication** | `/api/auth` | JWT session management, Login, Logout, Profile Sync |
| **Branches** | `/api/locations` | Branch CRUD and status management |
| **Culinary** | `/api/menu` | Menu items, image uploads via Cloudinary |
| **Operations** | `/api/tables` | Table state synchronization and session booking |
| **Diagnostics** | `/api/analytics` | High-precision sales and performance data |
| **Payroll** | `/api/salary` | Staff payout management and personal history |
| **Presence** | `/api/attendance` | Daily attendance logs and personal tracking |
| **Real-time** | `Socket.io` | **Room-based broadcasting** (`branch_<ID>`, `branch_<ID>_chef`, etc.) |

---

## 🗂 Data Models (`/server/models`)

- **`Order`**: The core of the OMS. Tracks items, total, assigned chef, status history, and culinary timestamps.
- **`User`**: Identity matrix containing roles (Admin, Chef, Staff), assigned branch, and base salary.
- **`Location`** (Branch): Physical branch details including capacity and operational status.
- **`MenuItem`**: Culinary nodes with pricing, category links, and imaging.
- **`Table`**: Dynamic operational units synchronized with the order state machine.
- **`Reservation`**: Temporal booking records for events and table reservations.
- **`Attendance`**: Temporal presence logs for all personnel.
- **`Transaction`**: High-level financial stream for revenue vs. expense analytics.

---

## 🛡️ Data Management & Integrity

- **Socket.io Room Architecture**: Surgical notification routing using intersection rooms (e.g., `branch_X_chef`) ensures relevant alerts reach the right personnel without noise.
- **State Machine Enforcement**: Server-side validation prevents invalid status transitions (e.g., an order cannot skip from `PLACED` to `READY`).
- **Transactional Consistency**: Database indexes on `branch`, `status`, and `createdAt` ensure sub-millisecond lookups during peak operational hours.
- **Input Masking**: Global enforcement of positive whole numbers for all fiscal and quantity inputs across the entire platform.
- **Debounced Synchronization**: Intelligent API-sync delays for high-velocity text inputs to maintain UI responsiveness while ensuring backend consistency.
- **Order State Immutability**: Context-aware locking of order sessions during the coupon validation lifecycle to prevent discount drift.

---

*Built for scale. Designed for performance. Driven by intelligence.*
