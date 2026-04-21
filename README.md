# Cafe OS - Multi-Location Intelligence Suite

Cafe OS is a high-fidelity, multi-tenant management ecosystem designed for modern hospitality chains. It integrates premium UI/UX with robust operational logic, providing a unified command center for managing global nodes (locations), personnel, and real-time fiscal performance.

## 🚀 Recent Intelligence Updates
*   **Identity Dossier System**: Self-service profile management with Cloudinary-backed biometric (profile image) sync and restricted field protection.
*   **Hierarchical Notifications**: Real-time operational alerts powered by Socket.io, routing critical updates from juniors to location-specific superiors.
*   **Fiscal Analytics Matrix**: Advanced yield tracking and profit analysis integrated directly with the Expense ledger, featuring Recharts-driven predictive visualizations.
*   **Glassmorphic UI Overhaul**: Transitioned to a "Zinc-amber" aesthetic with high-density information architecture and smooth Framer Motion transitions.

## 👥 Core Roles & Access Hierarchy
*   **Super Admin**: Global sovereign access, network configuration, and node initialization.
*   **Admin**: Regional oversight, global payroll reconciliation, and cross-location intelligence.
*   **Location Admin**: Node commander, personnel synchronization, local expenditure tracking, and roster management.
*   **Staff**: Operational execution, floor command (table management), and personal attendance protocols.

## 🛠 Technology Stack
*   **Frontend**: Next.js 14 (App Router), Tailwind CSS (Zinc-amber Profile), Framer Motion, Recharts, Lucide Icons.
*   **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.io (Real-time events).
*   **Storage**: Cloudinary for biometric and fiscal proof archival.
*   **Auth**: JWT-based secure sessions with cookie persistence and role-based middleware.

## 📊 Dashboard Ecosystem
*   `/dashboard/admin`: Global Operational Matrix, network-wide analytics, and the **All-Personnel Dossier**.
*   `/dashboard/location-admin`: Local node command, table engage/close, location fiscal ledger, and attendance roster.
*   `/dashboard/staff`: Operational station, real-time floor map, and culinary matrix reference.
*   `/dashboard/profile`: The **Personal Dossier** for identity management and credential synchronization.

## 📡 API Command Center
| Protocol | Method | Scope | Description |
| :--- | :--- | :--- | :--- |
| `/api/analytics/advanced` | GET | Admin+ | Fetches multi-dimensional yield data from fiscal ledger |
| `/api/users/update-profile` | PUT | Private | Synchronizes biometric and identity data |
| `/api/notifications` | GET | Private | Real-time operational alerts matrix |
| `/api/tables/:id/bill` | PUT | Location+ | Generates fiscal proof and archives table session |
| `/api/locations/:id` | PATCH | Admin+ | Updates hub parameters (Active/Inactive/Hold) |

---
*Built for scale. Designed for performance. Driven by intelligence.*
