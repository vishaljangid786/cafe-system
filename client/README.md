# Cafe Management System - Client

This is the frontend application for the Cafe Management System, built with **Next.js 16**, **React 19**, and **Tailwind CSS 4**.

## 🎨 Theme & Design System

The application features a modern, high-performance design system with full support for **Dark Mode** and **Light Mode**.

-   **Tech Stack**: Tailwind CSS 4, Framer Motion for animations.
-   **Theme Switching**: Managed via `ThemeContext.js`. It persists the user's preference in `localStorage` and respects system settings by default.
-   **Visual Style**:
    -   **Glassmorphism**: Uses custom utility classes like `.glass`, `.glass-card`, and `.glass-morphism` for a premium translucent feel.
    -   **Gradients**: Featured amber-to-orange gradients (`text-gradient`) and premium backgrounds.
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
    -   `ui/`: Base UI elements (buttons, inputs, etc.).
    -   `tables/`: Specialized data table components.
    -   `reservations/`, `Navbar.js`, `Sidebar.js`, `NotificationModal.js`.
-   **`context/`**: React Context providers for global state.
    -   `AuthContext.js`: Handles login/logout and user state.
    -   `ThemeContext.js`: Manages dark/light theme and input validations.
    -   `NotificationContext.js`: Manages real-time notifications via Socket.io.
-   **`services/`**: API integration layer.
    -   `api.js`: Axios instance with interceptors for auth tokens and error handling.
-   **`globals.css`**: Tailwind 4 configuration and custom utility classes.

### Root Files
-   **`middleware.js`**: Route guards and RBAC (Role-Based Access Control) logic.
-   **`next.config.mjs`**: Next.js configuration.
-   **`package.json`**: Dependency management (includes Recharts, Lucide, Framer Motion, etc.).

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
