# ☕ Cafe OS — Advanced Multi-Branch Management Suite

> A cinematic, high-fidelity cafe management platform engineered for modern hospitality chains. Unified command-and-control for branches, personnel, culinary inventory, fiscal analytics, and real-time operational diagnostics.

---

## 🌐 Live Infrastructure

| Component | Status | Production URL |
|---|---|---|
| **Frontend Node (Client)** | 🟢 Operational | https://cafe-booking-system-seven.vercel.app/ |
| **Backend Node (API)** | 🟢 Operational | https://cafe-system-backend.vercel.app/ |

---

## 🛠️ Project Status (Post-Audit)
- **Security Audit**: 🟢 **100% Complete**. Fully migrated to **httpOnly secure cookies** for authentication, mitigating XSS/CSRF risks.
- **Data Normalization**: 🟢 **Complete**. Unified transactional types (`REVENUE`, `EXPENSE`, `INCOME`) and personnel metadata across all modules.
- **Admin parity**: 🟢 **Achieved**. Advanced filtering (Date, Role, Salary) and Audit Logs are fully operational.
- **Infrastructure**: 🟢 **Production Ready**. Legcay routes removed and dependencies optimized (Express 4.19.2).

---

## 🚀 Key Feature Sets

### 🛰️ Strategic Branch Intelligence Network
- **Persistent Navigation Grid**: A high-fidelity navigation matrix that allows administrators to switch between global and branch-specific data streams with a single click.
- **Diagnostic Telemetry**: Integrated "Audit Details" that provide deep-dive metadata for each branch, including regional perimeter data and secure communication nodes.
- **Cross-Locational Metrics**: Real-time aggregation of throughput, efficiency, and attrition rates for all branches.
- **Hierarchical Personnel Roster**: Dynamic tree-view and tabbed filtering system (Admins, Branch Admins, Staff, Chefs) with strict role-based data inheritance.

### 🎭 Cinematic Design & Premium UI
- **Glassmorphism & Underglows**: Sophisticated translucent surfaces and dynamic status indicators.
- **Premium Micro-interactions**: Staggered motion entry animations and tactical hover-lift transitions.
- **Custom UI Components**: Engineered custom dropdowns, selection matrices, and search bars that replace native browser controls.
- **Uniform Floor Grid**: Standardized, responsive card-based table management interface enforcing visual consistency.

### 🍳 High-Performance Order Management System (OMS)
- **State Machine Architecture**: Orders flow through a strict protocol: `PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED`.
- **Administrative Overrides**: Universal `force-complete` and universal cancellation authority.
- **Chef Command Deck**: Real-time lane management for kitchen staff with status synchronization and integrated Dietary Categorization (Veg/Non-Veg/Vegan).
- **Transparent Billing**: 1:1 visual parity between digital bill previews and printed receipts, featuring automated branch branding and per-item rate transparency.

### 📊 Advanced Operational Intelligence
- **Audit Logging**: Comprehensive tracking of all administrative actions for accountability and security.
- **Recipe & Inventory Management**: Detailed culinary blueprints with integrated branch-specific stock monitoring.
- **Unified Advanced Analytics**: Real-time evaluation of automated revenue data metrics dynamically bound to specific administrative hierarchies.
- **Optimized Transactional Ledgers**: Accurate pipeline assessments evaluating cross-locational totals safely.

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

### 🏢 Branch & Location Management (`/dashboard/branch-admin` & `/dashboard/location-admin`)
- **Regional Oversight**: Specialized views for branch-specific personnel, attendance, and financial performance.
- **Local Inventory**: Management of culinary offerings and stock levels for specific operational nodes.
- **Operational Dashboards**: Real-time tracking of orders, bookings, and table sessions for the assigned location.

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
- `POST /login`: Session initialization & **httpOnly Secure Cookie** generation.
- `GET /profile`: Identity synchronization for active sessions (Server-side validation).
- `GET /logout`: Secure session termination (Cookie clearance).
- `GET /users`: (Admin) Global personnel directory with advanced status/salary filtering.

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
- **Recipes (`/api/recipes`)**: Culinary blueprints and ingredient mapping.

### 📢 Communication & Diagnostics
- **Notifications (`/api/notifications`)**: Alert archival and delivery.
- **Analytics (`/api/analytics`)**: Strategic financial and operational telemetry.
- **Export (`/api/export`)**: PDF/Excel dataset generation (Bills, Reports).
- **Bookings (`/api/bookings`)**: Reservation lifecycle management.

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
2. Configure `.env` or `.env.local` (`NEXT_PUBLIC_API_URL`)
3. `npm run dev`

---

*Built for scale. Designed for performance. Driven by intelligence.*
