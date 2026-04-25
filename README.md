# ☕ Cafe OS — Advanced Multi-Branch Management Suite

> A cinematic, high-fidelity cafe management platform engineered for modern hospitality chains. Unified command-and-control for branches, personnel, culinary inventory, fiscal analytics, and real-time operational diagnostics.

---

## 🌐 Live Infrastructure

| Component | Status | Production URL |
|---|---|---|
| **Frontend Node (Client)** | 🟢 Operational | https://cafe-booking-system-seven.vercel.app/ |
| **Backend Node (API)** | 🟢 Operational | https://cafe-system-backend.vercel.app/ |

---

## 🚀 Key Feature Sets

### 🛰️ Strategic Branch Intelligence Network
- **Persistent Navigation Grid**: A high-fidelity navigation matrix that allows administrators to switch between global and branch-specific data streams with a single click.
- **Diagnostic Telemetry**: Integrated "Audit Details" that provide deep-dive metadata for each branch, including regional perimeter data and secure communication nodes.
- **Cross-Locational Metrics**: Real-time aggregation of throughput, efficiency, and attrition rates for all branches.

### 🎭 Cinematic Design & Premium UI
- **Glassmorphism & Underglows**: Sophisticated translucent surfaces and dynamic status indicators.
- **Premium Micro-interactions**: Staggered motion entry animations and tactical hover-lift transitions.
- **Custom UI Components**: Engineered custom dropdowns and selection matrices that replace native browser controls.

### 🍳 High-Performance Order Management System (OMS)
- **State Machine Architecture**: Orders flow through a strict protocol: `PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED`.
- **Administrative Overrides**: Universal `force-complete` and universal cancellation authority.
- **Chef Command Deck**: Real-time lane management for kitchen staff with status synchronization.

---

## 📁 System Architecture: Frontend Dashboards

The application uses **Next.js 16** with a role-based access control (RBAC) system.

### 👑 Super Admin & Admin (`/dashboard/admin`)
- **`/analytics`**: Deep-dive behavioral mapping and kitchen performance auditing.
- **`/orders`**: Global order matrix for cross-branch surveillance.
- **`/locations`**: Branch lifecycle management (Create, Edit, Deactivate).
- **`/users` & `/staff`**: Personnel directory with salary and hierarchy management.
- **`/menu` & `/categories`**: Culinary inventory management with Cloudinary integration.
- **`/revenue` & `/expenses`**: High-level financial stream analytics.
- **`/payroll`**: Automated salary history and payout tracking.
- **`/tables`**: Global floor grid management.
- **`/coupons`**: Promotional engine with transactional locking logic.

### 👨‍🍳 Kitchen Command (`/dashboard/chef`)
- **`/orders`**: Live kitchen deck for order fulfillment and prep tracking.
- **`/expenses`**: Personal/Kitchen-specific expense logs.
- **`/profile`**: Personal efficiency stats and rank monitoring.

### 🏃 Frontline Operations (`/dashboard/staff`)
- **`/orders`**: Order creation and live status tracking for guest tables.
- **`/tables`**: Interactive floor map for booking and session management.
- **`/attendance`**: Biometric-style clock-in/out protocol.

---

## 📡 API Engine: Detailed Route Matrix

The backend is built on **Express.js** and **MongoDB**, utilizing a modular route-controller architecture.

### 🔐 Authentication & Identity (`/api/auth`)
- `POST /login`: Session initialization & JWT generation.
- `GET /me`: Identity synchronization for active sessions.
- `GET /users`: (Admin) Global personnel directory.

### 📋 Order Management (`/api/orders`)
- `GET /`: Retrieve orders (filtered by branch/status).
- `POST /`: Initialize a new culinary order.
- `PATCH /:id/status`: Transition order state (OMS State Machine).
- `GET /analytics`: Deep-dive metrics and peak hour mapping.
- `POST /force-complete`: Administrative state override.

### 🏢 Infrastructure & Personnel
- **Locations (`/api/locations`)**: Branch CRUD operations and status toggles.
- **Tables (`/api/tables`)**: Table status sync and session lifecycle.
- **Attendance (`/api/attendance`)**: Presence logs and clock-in/out logic.
- **Salary (`/api/salary`)**: Payout records and compensation history.

### 💰 Financial & Inventory
- **Transactions (`/api/transactions`)**: Revenue and Expense ledger.
- **Menu (`/api/menu`)**: Culinary catalog management.
- **Coupons (`/api/coupons`)**: Discount validation and transactional locking.
- **Categories (`/api/categories`)**: Culinary classification system.

### 📢 Communication & Diagnostics
- **Notifications (`/api/notifications`)**: Alert archival and delivery.
- **Analytics (`/api/analytics`)**: Strategic financial and operational telemetry.
- **Export (`/api/export`)**: PDF/Excel dataset generation (Bills, Reports).

---

## 🛡️ Data Integrity & Operational Protocols

- **Socket.io Room Architecture**: Surgical notification routing using intersection rooms (e.g., `branch_X_chef`).
- **State Machine Enforcement**: `omsMiddleware.js` prevents invalid status transitions.
- **Transactional Consistency**: Database indexes on `branch`, `status`, and `createdAt` for peak performance.
- **Input Masking**: Global enforcement of positive whole numbers for fiscal inputs.
- **Debounced Identity Sync**: 800ms debounce for Guest ID inputs to prevent cursor jumping.
- **Order State Immutability**: Locking order sessions during coupon validation.

---

## 🚀 Setup & Installation

### Backend Node
1. `npm install`
2. Configure `.env` (MongoDB, JWT, Cloudinary)
3. `npm run dev`

### Frontend Node
1. `npm install`
2. Configure `.env.local` (NEXT_PUBLIC_API_URL)
3. `npm run dev`

---

*Built for scale. Designed for performance. Driven by intelligence.*
