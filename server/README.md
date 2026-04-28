# Cafe Management System - Backend Node

The administrative engine of the Cafe Management System, providing a high-performance RESTful API and real-time synchronization layer.

## ⚙️ Core Infrastructure

- **Engine**: Node.js with Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: Socket.io for room-based broadcasting
- **Cloud Imaging**: Cloudinary integration for menu and personnel assets

## 📁 Directory Structure

- **`/config`**: System parameters and third-party integrations (MongoDB, Socket.io, Cloudinary).
- **`/controllers`**: Business logic implementations for all system entities (Orders, Users, Branches, etc.).
- **`/middlewares`**: Operational protocols including Auth, OMS State Machine, and Request Validation.
- **`/models`**: Mongoose schemas defining the system's data architecture (Attendance, AuditLog, Order, Recipe, etc.).
- **`/routes`**: RESTful endpoint definitions organized by functional domain.
- **`/utils`**: High-level utility services (Audit Logging, Scheduled Tasks, Export Services).
- **`/seed` & `/scripts`**: Database initialization tools and migration protocols.

## 🛡️ Operational Logic

### Order Management System (OMS)
The backend enforces a strict state machine for all orders. Transitions are validated in `omsMiddleware.js` to prevent invalid states.
- **Allowed States**: `PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `SERVED`, `COMPLETED`, `CANCELLED`, `REJECTED`.
- **Administrative Overrides**: Specialized endpoints allow for `force-complete` and universal cancellations to resolve operational deadlocks.

### Real-time Synchronization (Socket.io)
The system uses a granular room architecture to minimize network noise:
- `branch_<ID>`: Global updates for a specific location.
- `branch_<ID>_chef`: Dedicated kitchen alerts and lane management notifications.
- `global_admin`: High-level diagnostic and personnel alerts.

### Analytical Intelligence
The `/orders/analytics` engine performs real-time performance aggregation, including:
- **Efficiency Mapping**: Calculates preparation duration from status history timestamps.
- **Throughput Leaderboards**: Ranks personnel based on throughput volume and efficiency metrics.
- **Persistent Context**: Always provides global branch performance data, even when specific filters are applied to main metrics.

## 📡 API Reference Matrix

### Order Operations (`/api/orders`)
- `GET /analytics`: Deep-dive performance and distribution data.
- `PATCH /:id/status`: Transition an order through the lifecycle.
- `POST /force-complete`: Administrative override for terminal state transition.

### Infrastructure & Personnel
- **Locations (`/api/locations`)**: Branch lifecycle management and status synchronization.
- **Attendance (`/api/attendance`)**: Presence tracking and biometric-style clock logs.
- **Salary (`/api/salary`)**: Automated compensation history and payout records.

### Financial & Inventory
- **Transactions (`/api/transactions`)**: Integrated revenue and expense ledger.
- **Menu (`/api/menu`)**: Culinary catalog management with category mapping.
- **Recipes (`/api/recipes`)**: Culinary blueprints and ingredient mapping.
- **Coupons (`/api/coupons`)**: Promotional engine with transactional locking logic.

### Diagnostics & Reporting
- **Analytics (`/api/analytics`)**: Strategic financial and operational telemetry.
- **Export (`/api/export`)**: PDF/Excel generation for bills and administrative reports.
- **Notifications (`/api/notifications`)**: Real-time alert archival and delivery.

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file with:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   CLOUDINARY_CLOUD_NAME=name
   CLOUDINARY_API_KEY=key
   CLOUDINARY_API_SECRET=secret
   ```

3. **Initialize Database**:
   ```bash
   npm run seed
   ```

4. **Launch Engine**:
   ```bash
   npm run dev
   ```
