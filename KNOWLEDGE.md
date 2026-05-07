# CafeOS Knowledge Base & System Guide

This document serves as a comprehensive reference for AI models and developers to understand the CafeOS project architecture, business logic, and implementation patterns.

## 1. Project Overview
CafeOS is a premium, multi-location Cafe Management System designed with a "Cinematic UI" aesthetic. It manages everything from point-of-sale (POS) and inventory to staff attendance and complex financial analytics.

---

## 2. Core Architecture

### Backend (Node.js / Express / MongoDB)
- **Entry Point**: `server/server.js` (Server setup) and `server/app.js` (App configuration).
- **Database**: MongoDB using Mongoose ODM.
- **Authentication**: JWT-based auth with roles.
- **RBAC (Role Based Access Control)**:
    - `super_admin`: Full global access to all branches and system settings.
    - `admin`: Regional access to specific assigned branches.
    - `branch_admin`: Full access to a single specific branch.
    - `chef`: Access to kitchen displays and order status updates for their branch.
    - `staff`: Access to order creation and table management for their branch.

### Frontend (Next.js 15+ / Tailwind CSS / Framer Motion)
- **Structure**: Next.js App Router (`client/app`).
- **State Management**: React Context API (Auth, Theme, Notifications).
- **Design System**: "Cinematic UI" defined in `client/app/globals.css`. Uses semantic CSS variables for theme-aware components.
- **API Communication**: Axios instance in `client/app/services/api.js`.

---

## 3. Key Technical Patterns

### Location-Based Data Isolation (Critical)
The system uses a strict location-scoping pattern to ensure data privacy between branches.
- **Backend Utility**: `server/utils/accessControl.js` -> `scopedLocationId`.
- **Usage**: Almost every controller uses `scopedLocationId(req, requestedLocationId)` to sanitize queries. If a `branch_admin` tries to fetch data for another branch, this utility overrides the request to their assigned branch ID.

### The "Cinematic" Design System
- **Theme Variables**: Defined in `@layer base` in `globals.css`.
- **Primary Color**: Blue/Indigo (recently migrated from Amber).
- **Components**: Reusable UI components are in `client/app/components/ui/`.
- **Glassmorphism**: Extensively used with `backdrop-blur` and `glass-card` classes.

---

## 4. Directory Structure Map

### Server (`/server`)
- `/controllers`: Business logic for each resource (Orders, Reservations, Analytics, etc.).
- `/models`: Mongoose schemas. Note the relationships (e.g., `Order` belongs to a `Branch`).
- `/routes`: API endpoint definitions.
- `/utils`: Helper functions, especially `accessControl.js` and `asyncHandler.js`.
- `/scripts`: Database seeding and migration scripts.

### Client (`/client`)
- `/app/dashboard`: Nested routes for different roles (admin, branch-admin, chef, staff).
- `/app/context`: Context providers for global state.
- `/app/components`:
    - `/tables`: Complex table visualizations.
    - `/ui`: Atomic design components (Buttons, Cards, Inputs).
- `/app/services`: Axios setup and interceptors.

---

## 5. Core Business Workflows

### Order Lifecycle
1. **Creation**: Staff creates order (`OrderController.createOrder`). Stock is atomically deducted from `BranchStock`.
2. **Kitchen**: Chef sees order in real-time via Socket.io. Marks as `ACCEPTED` -> `PREPARING` -> `READY`.
3. **Serving**: Staff marks as `SERVED`.
4. **Billing**: Admin/Staff marks as `COMPLETED`. A `Transaction` (type: REVENUE) is automatically created.

### Inventory Management
- **Ingredients**: Global definitions.
- **Branch Inventory**: Stock levels per branch.
- **Auto-Deduction**: Recipes link `MenuItem` to `Ingredients`. When an order is completed, branch inventory is automatically updated.

### Financials
- **Revenue**: Generated from completed orders.
- **Expenses**: Manually added by admins or generated from payroll.
- **Analytics**: Aggregated in `AnalyticsController` using complex MongoDB pipelines.

---

## 6. Common Gotchas for AI
- **Hydration**: When using `window` or `localStorage` (like theme detection), always wrap in a `mounted` check to prevent Next.js hydration mismatches.
- **RBAC Middleware**: Always ensure `protect` and `authorizeRoles` middlewares are used in routes.
- **Icons**: The project uses `lucide-react` for all icons.

---

## 7. Current Project State (May 2026)
- **Theme**: Premium Blue Identity.
- **Dashboard**: Fully functional with advanced analytics and forecasting.
- **Status**: Stable, with recent fixes to location-scoping imports and hydration logic.

---

## 8. Data Models Reference

### Core Models
- **User**: Auth, role, assigned location, permissions, salary data.
- **Location**: Branch details (city, address, contact).
- **Order**: items, status, branch reference, customer details, total amount.
- **MenuItem**: name, price, costPrice, category, dietary type.
- **Transaction**: Financial record for revenue or expenses. The source of truth for analytics.
- **Attendance**: Daily staff presence records.
- **Payroll**: Monthly salary calculations and approval status.
- **BranchInventory**: Ingredient stock levels for a specific branch.

---

## 9. Important File Paths

| Purpose | File Path |
| :--- | :--- |
| Global Styles | `client/app/globals.css` |
| Auth Logic | `client/app/context/AuthContext.js` |
| API Configuration | `client/app/services/api.js` |
| Access Control | `server/utils/accessControl.js` |
| Main Dashboard | `client/app/dashboard/admin/page.js` |
| App Setup | `server/app.js` |
| Server Entry | `server/server.js` |

---

## 10. Developer Guidelines
1. **Theming**: Never use hardcoded colors. Use CSS variables like `var(--color-primary)`.
2. **Icons**: Use `lucide-react`.
3. **API Calls**: Always use the `api` service (Axios) to ensure JWT headers are included.
4. **Error Handling**: Wrap controller logic in `asyncHandler`.
5. **Security**: Location access must be enforced in the controller using `scopedLocationId`.
