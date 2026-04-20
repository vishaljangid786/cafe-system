# Cafe OS - Professional Cafe Management System

Cafe OS is a high-performance, multi-tenant management suite designed for cafe chains and hospitality businesses. It provides a comprehensive solution for managing multiple branches, tracking financial performance, automating payroll, and overseeing real-time floor operations.

## 🌟 Key Features

*   **Hierarchical RBAC (Role-Based Access Control)**:
    *   **Super Admin**: Global oversight, branch management, and full system configuration.
    *   **Admin**: Regional management, personnel oversight, and cross-branch analytics.
    *   **Branch Admin**: Branch-specific operations, table management, staff attendance, and local expenses.
    *   **Staff**: Daily attendance, order processing, and floor operations.
*   **Real-time Intelligence**: Socket.io integration for instant notifications across the administrative hierarchy.
*   **Personnel Dossier**: Comprehensive profile management system for Admins to view secure documents, qualification levels, and personal attributes of any employee.
*   **Live Table Command & Matrix Sync**:
    *   Real-time table status tracking (Available, Booked, Ongoing).
    *   **Matrix Synchronization**: Efficient batch processing of orders allowing multiple items to be staged locally before committing to the database.
*   **Fiscal Archival Protocol**: Automated financial integration where finalizing a table bill automatically generates an **Expense record** with image verification and clears the table status.
*   **Automated Payroll**: Attendance-based salary calculations with downloadable reports and yield tracking.
*   **Unified Visual Identity**: A premium design system using **Zinc & Amber** aesthetics, synchronized across all dashboards, modals, and the sidebar for a cohesive enterprise feel.

---

## 🛠️ Technology Stack

**Frontend:**
*   Next.js 14 (App Router)
*   Tailwind CSS (Vanilla CSS for custom components)
*   Framer Motion (Animations)
*   Lucide React (Modern Iconography)
*   Axios (API Communication)
*   React Hot Toast (Interactive Notifications)

**Backend:**
*   Node.js & Express.js
*   MongoDB & Mongoose (Schema-based Database)
*   Socket.io (Real-time Event Synchronization)
*   Cloudinary (Encrypted Image Storage)
*   Multer (Multipart Form Handling)
*   JWT (Secure Authentication & Authorization)

---

## 📂 Project Structure

### 🌐 Frontend (client/)
*   `/app/login`: Secure authentication with password visibility toggles.
*   `/app/signup`: Hierarchical personnel registration (restricted by role).
*   `/app/dashboard/admin`: Global analytics, branch creation, payroll, and the **All Staff Dossier**.
*   `/app/dashboard/branch-admin`: Daily operations, table command, branch expenses, and attendance.
*   `/app/dashboard/staff`: Personal portal for attendance and assigned tasks.
*   `/app/components/ui`: Reusable animated containers, modals, and confirm dialogs.

### ⚙️ Backend (server/)

#### 🛣️ API Routes
| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | POST | Protected | Hierarchical registration |
| `/api/users` | GET | Admin+ | Retrieve full personnel list |
| `/api/users/:id/block` | PUT | Admin+ | Toggle account access |
| `/api/tables` | GET | Branch Admin+ | Fetch branch floor plan |
| `/api/tables/:id/orders` | PUT | Branch Admin+ | Matrix Sync (Batch orders) |
| `/api/tables/:id/bill` | PUT | Branch Admin+ | Fiscal Archival (Bill upload) |
| `/api/expenses` | GET/POST | Branch Admin+ | Financial ledger management |
| `/api/attendance/mark` | POST | Branch Admin | Digital roll call |
| `/api/analytics/branch` | GET | Admin+ | Cross-branch performance |

#### 🎮 Controllers
*   `authController`: JWT generation, password hashing (Bcrypt), and hierarchical registration.
*   `tableController`: Real-time status logic, batch order calculation, and automated archival.
*   `expenseController`: Multi-step financial entry with receipt verification.
*   `userController`: Account promotions, blocklists, and Dossier data retrieval.
*   `notificationController`: Persistent alert systems with Socket.io emitters.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   MongoDB Atlas Account
*   Cloudinary Account (Cloud name, API Key, API Secret)

### Installation

1.  **Backend Setup**:
    ```bash
    cd server
    npm install
    # Create .env with MONGO_URI, JWT_SECRET, CLOUDINARY details
    npm run dev
    ```

2.  **Frontend Setup**:
    ```bash
    cd client
    npm install
    # Create .env.local with NEXT_PUBLIC_API_URL
    npm run dev
    ```

---

## 🛡️ License
This project is licensed under the ISC License.

---
*Maintained by the Cafe OS Engineering Team.*
