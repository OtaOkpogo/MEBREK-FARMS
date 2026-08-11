# Mebrek Farms — Farm Management System

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)](https://github.com/OtaOkpogo)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MongoDB-47A248)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-Private-lightgrey)](https://github.com/OtaOkpogo)

A full-stack poultry farm management platform built for **Mebrek Farms, Eket, Akwa Ibom, Nigeria**.

The system provides centralized management of production, egg and manure sales, inventory, workers, attendance, bird health, vaccinations, medications, mortality, expenses, notifications, reporting, customer orders, and administrative access control.

## Table of Contents

- [Project Overview](#project-overview)
- [Production Status](#production-status)
- [Developer](#developer)
- [Tech Stack](#tech-stack)
- [System Modules](#system-modules)
- [Role-Based Access Control](#role-based-access-control)
- [Egg Sales](#egg-sales)
- [Manure Sales](#manure-sales)
- [Reporting](#reporting)
- [Real-Time Notifications](#real-time-notifications)
- [Global Search](#global-search)
- [Soft Delete and Restore](#soft-delete-and-restore)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Security Architecture](#security-architecture)
- [Architectural Conventions](#architectural-conventions)
- [Testing Checklist](#testing-checklist)
- [Deployment](#deployment)
- [Production Security Checklist](#production-security-checklist)
- [Maintenance Guidelines](#maintenance-guidelines)
- [Important Files](#important-files)
- [License](#license)

## Project Overview

Mebrek Farms Farm Management System is a full-stack business application designed to centralize and simplify poultry farm operations. It replaces fragmented manual processes with structured digital recording, monitoring, searching, reporting, and administration.

## Production Status

**Status: Production Ready**

The system has completed functional testing and authorization/security checks across the major modules, including authentication, role-based access, protected APIs, dashboard, production, sales, inventory, health records, workers, expenses, notifications, reports, search, backup, orders, soft-delete/restore workflows, and Socket.IO communication.

## Developer

**Ota Okpogo**  
GitHub: **https://github.com/OtaOkpogo**

## Tech Stack

### Frontend

- React + Vite
- React Router
- Tailwind CSS
- Recharts
- Socket.IO Client
- Axios
- jsPDF + jspdf-autotable
- SheetJS / XLSX
- React Toastify / React Hot Toast

### Backend

- Node.js + Express.js
- MongoDB + Mongoose
- JWT authentication
- Socket.IO
- dotenv
- bcryptjs

### Architecture

```text
React + Vite Frontend
        │
        │ REST API / Socket.IO
        ▼
Node.js + Express Backend
        │
        │ Mongoose
        ▼
MongoDB Database
```

## System Modules

| Module             | Description                                                      |
| ------------------ | ---------------------------------------------------------------- |
| **Dashboard**      | Role-filtered KPI cards, charts and operational summaries        |
| **Production**     | Daily poultry and egg production tracking by pen                 |
| **Egg Sales**      | Multi-category egg sales, pricing, invoices and payments         |
| **Manure Sales**   | Dry/wet manure sales, pricing, invoices and payments             |
| **Feed Inventory** | Feed stock, pricing, supplier and expiry tracking                |
| **Feed Invoices**  | Feed purchase invoices with soft-delete and restore              |
| **Warehouse**      | General farm warehouse inventory                                 |
| **Room Inventory** | Room-based equipment and asset tracking                          |
| **Bird Health**    | Health issues, treatments, veterinary consultation and follow-up |
| **Vaccinations**   | Vaccine administration and follow-up tracking                    |
| **Medications**    | Medication administration records                                |
| **Mortality**      | Bird mortality and financial loss tracking                       |
| **Attendance**     | Daily worker attendance                                          |
| **Workers**        | Complete employee and HR records                                 |
| **Staff Accounts** | Administrative account management                                |
| **Expenses**       | Farm expense tracking and reporting                              |
| **Notifications**  | Internal manager/superadmin communication                        |
| **Reports**        | Cross-module reporting with Excel/PDF export                     |
| **Global Search**  | Role-filtered search across farm records                         |
| **Backup**         | Database export for superadmin                                   |
| **Orders**         | Customer order intake and administrative order management        |

## Role-Based Access Control

The system uses three roles: **staff**, **manager**, and **superadmin**. Authorization is enforced at both frontend and backend levels. Frontend restrictions improve UX; backend authorization is the actual security boundary.

| Module         |    Staff    |    Manager    |   Superadmin   |
| -------------- | :---------: | :-----------: | :------------: |
| Dashboard      |   Limited   |    Limited    |      Full      |
| Orders         |     ✅      |      ✅       |       ✅       |
| Production     |     ✅      |      ✅       |       ✅       |
| Attendance     | View/Create | Full + Delete | Full + Restore |
| Bird Health    | View/Create | Full + Delete | Full + Restore |
| Vaccinations   | View/Create | Full + Delete | Full + Restore |
| Medications    | View/Create | Full + Delete | Full + Restore |
| Mortality      |     ✅      |      ✅       |       ✅       |
| Notifications  |     ❌      |      ✅       |       ✅       |
| Reports        |     ❌      |      ✅       |       ✅       |
| Egg Sales      |     ❌      |      ✅       |  ✅ + Restore  |
| Manure Sales   |     ❌      |      ✅       |  ✅ + Restore  |
| Feed Inventory |     ❌      |      ✅       |       ✅       |
| Feed Invoices  |     ❌      |      ✅       |  ✅ + Restore  |
| Warehouse      |     ❌      |      ✅       |  ✅ + Restore  |
| Room Inventory |     ❌      |      ✅       |       ✅       |
| Workers        |     ❌      |      ❌       |       ✅       |
| Staff Accounts |     ❌      |      ❌       |       ✅       |
| Expenses       |     ❌      |      ❌       |       ✅       |
| Backup         |     ❌      |      ❌       |       ✅       |
| Global Search  |   Limited   |     Broad     |      Full      |

### Important Access Rules

- **Workers are superadmin-only.**
- **Staff Accounts, Expenses and Backup are superadmin-only.**
- **Reports are unavailable to staff.**
- **Egg Sales and Manure Sales are unavailable to staff.**
- **Deleted-record visibility and restore are restricted to superadmin where supported.**

## Egg Sales

Egg Sales supports multiple categories on one customer invoice.

| Egg Category | Crate Price |
| ------------ | ----------: |
| Big          |      ₦5,000 |
| Jumbo        |      ₦5,800 |
| Turkey       |      ₦6,000 |
| Normal       |      ₦4,900 |
| Small        |      ₦4,000 |

Example single transaction:

```text
Big       → 2 crates
Jumbo     → 1 crate
Turkey    → 2 crates
Normal    → 3 crates
Small     → 1 crate
```

The system calculates the complete transaction as one invoice while preserving each category as an individual line item. Server-side price validation prevents tampered client prices from determining the final amount.

Supported features include customer details, invoice numbering, crates, loose eggs, discounts, transport charges, amount paid, balances, payment methods/status, remarks, PDF invoices, soft deletion, and authorized restoration.

## Manure Sales

Manure Sales follows the same general financial pattern as Egg Sales, including line items, customer information, pricing, invoices, discounts, transport charges, payments, balances, status, PDF invoices, and soft-delete/restore where permitted. Price-sensitive values are validated server-side.

## Reporting

Reports cover cross-module operational information such as:

- Production
- Egg Sales
- Manure Sales
- Feed Usage
- Mortality
- Warehouse
- Staff

Reports can be exported to **PDF** and **Excel**, with access filtered by role.

## Real-Time Notifications

Socket.IO provides real-time communication for:

- Internal notifications
- Manager/superadmin messaging
- Live notification updates
- Unread notification counts
- Conversation updates
- Socket-driven UI refreshes

Server-side emissions use the Express application Socket.IO instance.

## Global Search

Global Search provides cross-module search while filtering results according to the authenticated user's role, preventing discovery of unauthorized records.

## Soft Delete and Restore

Modules using soft deletion retain records rather than immediately removing them. Typical fields are:

```text
isDeleted
deletedAt
deletedBy
```

Depending on the module, deletion metadata may include the deleting user's ID, name, and role. Authorized superadmins can review and restore records where supported.

## Architecture

### Frontend Responsibilities

- User interface and navigation
- Forms and client-side validation
- Charts and dashboards
- API service calls
- Route protection and role-based menu visibility
- Real-time UI updates
- PDF/Excel exports

### Backend Responsibilities

- Authentication and authorization
- Business logic
- Data validation
- Financial calculations
- Database operations
- Soft deletion and restore
- Socket.IO events
- API security

### Database

MongoDB stores operational data through Mongoose models.

## Project Structure

```text
Mebrek-Farms/
│
├── backend/
│   ├── controllers/       # Business logic per module
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/            # Mongoose schemas
│   ├── routes/            # Express routes
│   ├── services/          # Backend service logic
│   ├── server.js          # Application entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── admin/         # Admin-panel modules
│   │   ├── pages/         # Public and selected application pages
│   │   ├── components/    # Shared UI components
│   │   ├── services/      # API service wrappers
│   │   ├── routes/
│   │   │   └── ProtectedRoute.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB local instance or MongoDB Atlas
- Git

### Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
PORT=5000
```

Start the backend:

```bash
npm start
```

Default backend URL:

```text
http://localhost:5000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

The frontend API configuration must point to the running backend.

## Environment Configuration

### Backend

```env
MONGO_URI=
JWT_SECRET=
PORT=5000
```

### Frontend

Configure the API base URL through the project's API client/environment configuration. For local development it normally points to:

```text
http://localhost:5000/api
```

For production:

```text
Frontend → Production Backend
Backend  → Production MongoDB
```

Never commit production credentials or `.env` files to the repository.

## Security Architecture

Security is enforced in two layers.

### Frontend Layer

The frontend uses protected routes, role-based navigation, and role-based menu visibility to provide a clean user experience.

### Backend Layer

The backend uses:

```js
protect
allowRoles(...)
```

to enforce authorization on protected endpoints.

### Direct API Access Test

Frontend hiding is not sufficient. A user may manually call an endpoint.

For a superadmin-only Workers endpoint:

```text
GET /api/workers
```

A manager or staff account should receive:

```text
403 Forbidden
```

and must not receive worker records.

## Architectural Conventions

### Authentication Middleware

Use:

```js
const { protect, allowRoles } = require("../middleware/authMiddleware");
```

`middleware/authMiddleware.js` is the active authorization middleware. Do not use the legacy `middleware/auth.js` where role authorization is required.

### JWT User ID

Authenticated user IDs are accessed through:

```js
req.user.id;
```

not `req.user._id`.

### Role Authorization

Protected routes should explicitly specify permitted roles, for example:

```js
router.get("/workers", protect, allowRoles("superadmin"), getWorkers);
```

### Soft Delete

Use `isDeleted`, `deletedAt`, and `deletedBy` for modules following the soft-delete pattern. Restore operations clear deletion metadata.

### Route Ordering

Register `/deleted` before `/:id` so Express does not interpret `deleted` as an ID parameter.

### Update Endpoints

Update endpoints should whitelist accepted fields rather than passing `req.body` blindly to `findByIdAndUpdate()` or `Object.assign()`. This prevents protected fields such as soft-delete properties from being tampered with through normal update routes.

### API Client

`apiClient.js` handles global API response processing. Service functions should return clean data rather than repeatedly requiring components to unwrap Axios responses.

### Socket.IO

Use:

```js
req.app.get("io");
```

for server-side Socket.IO emissions rather than `req.io`.

### Shared Constants

Shared values such as farm pen names should remain synchronized between backend CommonJS and frontend ES Module implementations.

### Financial Validation

Price-sensitive modules such as Egg Sales and Manure Sales must validate prices on the backend. Client-supplied financial values are never treated as authoritative.

## Testing Checklist

### Authentication

- [ ] Valid login works.
- [ ] Invalid credentials are rejected.
- [ ] Logout works.
- [ ] Expired/invalid JWTs are rejected.
- [ ] Protected endpoints reject unauthenticated requests.

### Authorization

- [ ] Staff cannot access manager-only modules.
- [ ] Manager cannot access Workers.
- [ ] Manager cannot access Staff Accounts.
- [ ] Manager cannot access Expenses.
- [ ] Staff cannot access Reports.
- [ ] Staff cannot access Egg Sales.
- [ ] Staff cannot access Manure Sales.
- [ ] Superadmin can access authorized modules.

### Data Operations

- [ ] Create records.
- [ ] Edit records.
- [ ] Delete records.
- [ ] Restore records where supported.
- [ ] Deleted records are hidden from unauthorized roles.
- [ ] Superadmin can review deleted records where supported.

### Financial Modules

- [ ] Egg category prices calculate correctly.
- [ ] Multiple egg categories can appear on one invoice.
- [ ] Discounts calculate correctly.
- [ ] Transport charges calculate correctly.
- [ ] Amount paid and outstanding balances calculate correctly.
- [ ] Payment status is correct.
- [ ] Invoice generation works.
- [ ] Backend price validation works.

### Real-Time Features

- [ ] Socket.IO connects successfully.
- [ ] Notifications appear in real time.
- [ ] Unread counts update.
- [ ] Internal messaging updates correctly.
- [ ] Socket reconnection behaves correctly.

## Deployment

### Frontend

Recommended platforms:

- Vercel
- Netlify

### Backend

Recommended platforms:

- Render
- Railway
- VPS

### Database

Recommended:

- MongoDB Atlas
- Production MongoDB server

### Deployment Flow

```text
GitHub Repository
       │
       ├── Frontend → Vercel / Netlify
       │
       └── Backend → Render / Railway / VPS
                         │
                         ▼
                   MongoDB Atlas
```

Before deployment:

1. Configure the production database.
2. Generate a strong production JWT secret.
3. Configure production CORS.
4. Configure the frontend API URL.
5. Configure backend environment variables.
6. Enable HTTPS.
7. Verify production Socket.IO connectivity.
8. Test authentication and role restrictions.
9. Test direct API access.
10. Test database backup.
11. Perform a final production smoke test.

## Production Security Checklist

- [ ] Replace the development JWT secret.
- [ ] Use a strong production JWT secret.
- [ ] Configure production MongoDB credentials.
- [ ] Restrict MongoDB network access.
- [ ] Configure production CORS.
- [ ] Enable HTTPS.
- [ ] Verify every protected route.
- [ ] Verify every role restriction.
- [ ] Test direct API access.
- [ ] Test invalid JWTs.
- [ ] Test expired JWTs.
- [ ] Verify soft-delete permissions.
- [ ] Verify restore permissions.
- [ ] Confirm backups work.
- [ ] Confirm production environment variables.
- [ ] Confirm `.env` is excluded from Git.
- [ ] Confirm database credentials are not exposed.
- [ ] Confirm frontend points to the production API.
- [ ] Confirm backend points to the production database.
- [ ] Perform a final end-to-end test.

## Maintenance Guidelines

### Do

- Back up the database regularly.
- Monitor server logs.
- Monitor MongoDB health.
- Keep dependencies updated carefully.
- Test authorization after security-related changes.
- Test financial calculations after sales-related changes.
- Keep environment secrets outside source control.
- Document future changes.

### Avoid

- Editing production data directly without a backup.
- Removing authorization middleware.
- Trusting frontend financial calculations.
- Disabling backend role checks.
- Committing `.env` files.
- Changing database schemas without considering existing records.
- Deploying untested code directly to production.

## Important Files

### Backend

```text
backend/server.js
backend/middleware/authMiddleware.js
backend/controllers/
backend/models/
backend/routes/
backend/services/
```

### Frontend

```text
frontend/src/App.jsx
frontend/src/routes/ProtectedRoute.jsx
frontend/src/services/apiClient.js
frontend/src/admin/
frontend/src/pages/
frontend/src/components/
frontend/src/services/
```

## License

**Proprietary — Internal Use for Mebrek Farms**

This software is developed for Mebrek Farms and is not licensed for unrestricted redistribution, resale, modification, or commercial reuse without authorization.

## Project Status

**Mebrek Farms Farm Management System — Production Ready**

A centralized, secure and reliable platform for managing the day-to-day operations of a modern poultry farm.

---

**Built for Mebrek Farms.**  
**Developed by Ota Okpogo.**
