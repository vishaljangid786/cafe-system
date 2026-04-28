# Cafe Management System - Client

This is the frontend application for the Cafe Management System, built with **Next.js 16**, **React 19**, and **Tailwind CSS 4**.

## 🎨 Theme & Design System

The application features a modern, high-performance design system with full support for **Dark Mode** and **Light Mode**.

-   **Tech Stack**: Tailwind CSS 4, Framer Motion for animations.
-   **Theme Switching**: Managed via `ThemeContext.js`. It persists the user's preference in `localStorage` and respects system settings by default.
-   **Visual Style**:
    -   **Glassmorphism**: Uses custom utility classes like `.glass`, `.glass-card`, and `.glass-morphism` for a premium translucent feel.
    -   **Branch Intelligence Network**: Persistent navigation grid for cross-branch surveillance and diagnostic telemetry.
    -   **Custom Selection Matrix**: Replaces native browser dropdowns with animated, state-aware selection hubs for global and branch-specific context switching.
    -   **Micro-animations**: Staggered entry animations and tactical hover-lift transitions using `framer-motion`.
    -   **Input Safety**: Global protection against invalid characters (-, ., e) in number inputs via `ThemeContext` event listeners.

## 🛣️ Routing & Architecture

The project uses the **Next.js App Router** for its structure.

### Public Routes
-   `/login`: User authentication page.
-   `/signup`: Personnel registration (restricted to Admin/Super Admin).
-   `/setup`: Initial system configuration.

### Protected Routes (Dashboard)
All routes under `/dashboard` are protected by `middleware.js` and require a valid JWT token.

-   **Admin (`/dashboard/admin`)**:
    -   `summary`, `orders`, `payroll`, `tables`, `staff`, `attendance`, `bookings`, `revenue`, `menu`, `coupons`, `location-comparison`, `expenses`, `users`, `locations`.
-   **Branch Admin (`/dashboard/branch-admin`)**:
    -   `tables`, `staff`, `attendance`, `bookings`, `revenue`, `menu`, `salary`, `expenses`.
-   **Location Admin (`/dashboard/location-admin`)**:
    -   Specialized administrative oversight for specific operational nodes.
-   **Chef (`/dashboard/chef`)**:
    -   Main chef portal and `expenses`.
-   **Staff (`/dashboard/staff`)**:
    -   `orders`, `tables`, `attendance`, `menu`, `expenses`.
-   **Other**:
    -   `/dashboard/notifications`: Global notification center.
    -   `/dashboard/reservations`: Booking management.
    -   `/dashboard/profile`: User settings and profile management.

## 📁 File Structure

### `/app`
The core of the application containing pages, layouts, and global styles.
-   **`components/`**: Reusable UI components.
    -   **`ui/`**: Atomic design elements (Buttons, Cards, Modals, PageTransitions, etc.).
    -   **`tables/`**: Specialized components for data grids (AssignTableModal, BillPreview, TableCard).
    -   **`reservations/`**: Management tools for guest bookings.
    -   `Navbar.js`, `Sidebar.js`, `NotificationPanel.js`.
-   **`context/`**: React Context providers for global state.
    -   `AuthContext.js`: Security and session management.
    -   `ThemeContext.js`: Aesthetics and input safety protocols.
    -   `NotificationContext.js`: Real-time synchronization via Socket.io.
-   **`dashboard/`**: Role-based routing modules (admin, branch-admin, location-admin, chef, staff).
-   **`services/`**: API integration layer.
    -   `api.js`: Centralized Axios configuration for backend communication.
-   **`globals.css`**: Tailwind CSS 4 configuration and cinematic design tokens.

### Root Files
-   **`middleware.js`**: Universal route guarding and RBAC enforcement.
-   **`next.config.mjs`**: Next.js framework parameters.
-   **`package.json`**: Integrated dependency matrix (Recharts, Lucide, Framer Motion, Axios).

## 🚀 Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Environment**:
    Create a `.env.local` file with:
    ```env
    NEXT_PUBLIC_API_URL=http://localhost:5000/api
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

4.  **Build for Production**:
    ```bash
    npm run build
    npm start
    ```
