# ☕ CafeOS — High-Performance Multi-Branch Management Suite

> A cinematic, high-fidelity cafe management platform engineered for modern hospitality chains. Unified command-and-control for branches, personnel, culinary inventory, fiscal analytics, and real-time operational diagnostics.

---

## 📊 Current Project State (May 2026)

- **Operational Health**: 🟢 **Stable**. Both Frontend (Next.js) and Backend (Express) are fully synchronized.
- **Command Center**: 🚀 **Deployed**. The Admin Orders Dashboard now features "Tactical Purge" and surgical override capabilities for all active order signals.
- **Security Protocols**: 🛡️ **Hardened**. Implemented Location-Based Data Isolation and role-gated administrative purges.
- **Infrastructure**: 🟢 **Production Ready**. Consolidated documentation and optimized state machines.

---

## 🏗️ System Architecture & Frameworks

| Layer | Technology Stack |
| :--- | :--- |
| **Frontend** | Next.js 15+ (App Router), React 19, Tailwind CSS 4, Framer Motion |
| **Backend** | Node.js, Express.js, Socket.io (Real-time Sync) |
| **Database** | MongoDB (Mongoose ODM) |
| **Infrastructure** | Cloudinary (Assets), JWT (Auth), Axios (API) |

---

## 📂 Project Structure

```text
.
├── client/                     # Frontend Application (Next.js)
│   ├── app/                    # App Router, Context, Components, Services
│   ├── middleware.js           # Matcher stub (auth is enforced by the API + AuthContext)
│   ├── next.config.mjs         # Framework config + security headers + API proxy
│   └── public/                 # Static assets
├── server/                     # Backend API (Express.js)
│   ├── controllers/            # Business logic
│   ├── models/                 # Mongoose Schemas
│   ├── routes/                 # API Endpoints
│   ├── middlewares/            # Security & OMS State Machine
│   ├── utils/                  # Access Control & Logging
│   └── scripts/                # Database Seeders & Migrations
├── README.md                   # Master Documentation
└── bugs.md                     # Known-issues / test log
```

> **Note on auth:** route protection is enforced server-side by the Express API
> (every endpoint re-checks role/permission) and mirrored client-side by
> `AuthContext`. `client/middleware.js` is intentionally a passthrough — Next.js
> edge middleware can't reliably read the API-owned cookie across domains.

---

## 📡 Operational Workflows & Flows

### 1. High-Performance Order Management System (OMS)
Orders flow through a strict state machine protocol:
`PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED` → `COMPLETED`

- **Tactical Purge**: Administrators can now permanently remove erroneous order records directly from the Monitor Matrix (both Grid and List views).
- **Real-time Sync**: Socket.io ensures chefs and staff see status updates instantly across their specific branch rooms.
- **Administrative Overrides**: Admins have universal `force-complete` and cancellation authority to resolve operational deadlocks.

### 2. Location-Based Data Isolation
The system ensures strict data privacy between branches:
- **Scoped Identity**: Every controller uses `scopedLocationId` to prevent data leakage between operational nodes.
- **RBAC Enforcement**: Permissions are dynamically evaluated per request, ensuring Branch Admins only see data for their assigned sectors.

### 3. Inventory & Recipe Logic
- **Culinary Blueprints**: Recipes link `MenuItem` to specific `Ingredients`.
- **Auto-Deduction**: Upon order fulfillment, the system atomically updates `BranchStock` levels across the operational node.

---

## 🎨 Cinematic Design & Premium UI

- **Theme Identity**: Premium Blue/Indigo aesthetic with full Dark/Light mode support.
- **Glassmorphism**: Translucent surfaces using `.glass-card` and `.backdrop-blur`.
- **Monitor Matrix**: High-density dashboards featuring Recharts visualizations and real-time "Signal Probes" for order inspection.
- **Input Safety**: Per-field numeric validation via `utils/inputValidation.js` (`blockNegative` allows decimals for money/price fields; `blockNonInteger` for integer-only fields like age/quantity), plus server-side validation. (A previous global key-blocking listener was removed because it also blocked decimal prices.)

---

## 🛡️ Role-Based Access Control (RBAC)

| Role | Access Level |
| :--- | :--- |
| **Super Admin** | Global surveillance, branch creation, system-wide settings. |
| **Admin** | Regional oversight for assigned branches and personnel auditing. |
| **Branch Admin** | Full operational control over a single specific branch. |
| **Chef** | Kitchen command deck and order fulfillment tracking. |
| **Staff** | Order creation, table management, and attendance protocols. |

---

## 🚀 Getting Started

### 1. Environment Configuration
Create `.env` files in both root directories:

**Server (`server/.env`)**:
```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
```

**Client (`client/.env.local`)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### 2. Installation & Launch
```bash
# Install dependencies
npm install

# Initialize database
cd server && npm run seed

# Launch System
# (Run in separate terminals)
cd server && npm run dev
cd client && npm run dev
```

---
*Built for scale. Designed for performance. Driven by intelligence.*