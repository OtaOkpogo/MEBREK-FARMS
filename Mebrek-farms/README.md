# Mebrek Farms — Farm Management System

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)](https://github.com/OtaOkpogo)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MongoDB-47A248)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-Private-lightgrey)](https://github.com/OtaOkpogo)

A full-stack poultry farm management platform built for **Mebrek Farms, Eket, Akwa Ibom, Nigeria**.

The system centralizes daily farm operations including production tracking, egg and manure sales, invoicing, feed and warehouse inventory, bird health, vaccinations, medications, mortality, workers, attendance, expenses, notifications, reporting, global search, backup, and order management.

It uses **role-based access control, server-side authorization, soft-delete/restore workflows, server-validated financial calculations, and Socket.IO real-time updates**.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [System Modules](#system-modules)
- [Role-Based Access Control](#role-based-access-control)
- [Security Architecture](#security-architecture)
- [Architectural Conventions](#architectural-conventions)
- [Egg Sales Pricing](#egg-sales-pricing)
- [Real-Time Communication](#real-time-communication)
- [Exports and Invoicing](#exports-and-invoicing)
- [Testing and Production Readiness](#testing-and-production-readiness)
- [Deployment](#deployment)
- [Production Checklist](#production-checklist)
- [Maintenance](#maintenance)
- [License](#license)
- [Developer](#developer)

## Overview

**Mebrek Farms Farm Management System** provides a centralized platform for managing poultry farm operations.

The application consists of:

- React/Vite frontend.
- Node.js/Express REST API.
- MongoDB/Mongoose data layer.
- JWT authentication.
- Role-based authorization.
- Socket.IO real-time communication.
- Reporting and export capabilities.

The system is intended for internal farm operations and is configured as a **private/proprietary application**.

## Key Features

### Farm Operations

- Daily poultry production tracking.
- Pen-level production records.
- Opening and closing bird stock.
- Mortality tracking.
- Feed consumption tracking.
- Egg production calculations.
- Production percentage calculations.
- Bird health monitoring.
- Vaccination records.
- Medication records.
- Follow-up and due-date tracking.

### Sales and Finance

- Multi-category egg sales.
- Egg sales invoicing.
- Manure sales.
- Customer records.
- Payment tracking.
- Outstanding balance calculations.
- Payment status tracking.
- Discounts and transport charges.
- Farm expense tracking.
- Financial reporting.

### Inventory

- Feed inventory.
- Feed purchase records.
- Feed invoices.
- Warehouse inventory.
- Room inventory.
- Low-stock monitoring.
- Stock status tracking.
- Equipment condition tracking.
- Soft-delete and restore workflows.

### Human Resources

- Worker records.
- Employee/staff numbers.
- Personal information.
- Employment details.
- Salary information.
- Bank details.
- Next-of-kin information.
- Worker attendance.
- Staff account management.
- Role assignment and account status management.

### Administration

- Dashboard.
- Role-based reporting.
- Internal notifications.
- Real-time communication.
- Global search.
- Database backup.
- Order management.
- PDF and Excel exports.

## Technology Stack

### Frontend

- React
- Vite
- React Router
- Tailwind CSS
- Recharts
- Socket.IO Client
- Axios
- jsPDF
- jspdf-autotable
- SheetJS / xlsx
- react-toastify / react-hot-toast

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- JSON Web Tokens (JWT)
- Socket.IO
- dotenv
- bcryptjs

## Getting Started

### Prerequisites

- Node.js **v18 or later**
- npm
- MongoDB local server or MongoDB Atlas
- Git

### Clone the Repository

```bash
git clone https://github.com/OtaOkpogo/Mebrek-farms.git
cd Mebrek-farms
```

### Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
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

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

The frontend development URL must match the backend CORS configuration.

## Environment Variables

### Backend

| Variable     | Description                               |
| ------------ | ----------------------------------------- |
| `MONGO_URI`  | MongoDB connection string                 |
| `JWT_SECRET` | Secret used to sign and verify JWT tokens |
| `PORT`       | Backend server port, normally `5000`      |

Production secrets must never be committed to Git.

## Project Structure

```text
Mebrek-farms/
├── backend/
│   ├── controllers/       # Business logic
│   ├── models/            # Mongoose schemas
│   ├── routes/            # Express routes
│   ├── middleware/        # Authentication/authorization
│   ├── services/          # Backend services where applicable
│   └── server.js          # Express + Socket.IO entry point
│
├── frontend/
│   └── src/
│       ├── admin/         # Administrative pages
│       ├── pages/         # Application pages
│       ├── components/    # Shared UI components
│       ├── services/      # API service wrappers
│       ├── routes/        # Protected routing
│       └── App.jsx        # Route tree
│
└── README.md
```

## System Modules

| Module             | Description                                                                        |
| ------------------ | ---------------------------------------------------------------------------------- |
| **Dashboard**      | Role-filtered KPI cards and charts                                                 |
| **Production**     | Daily egg production, stock, mortality, feed consumption and production percentage |
| **Egg Sales**      | Multi-category egg sales, pricing, payments and invoices                           |
| **Manure Sales**   | Dry/wet manure sales and invoicing                                                 |
| **Feed Inventory** | Feed stock, pricing, supplier and expiry tracking                                  |
| **Feed Invoices**  | Feed purchase invoices with soft-delete/restore                                    |
| **Warehouse**      | General warehouse inventory                                                        |
| **Room Inventory** | Room-level equipment and asset tracking                                            |
| **Bird Health**    | Health issues, symptoms, treatment and follow-up                                   |
| **Vaccinations**   | Vaccine administration and follow-up tracking                                      |
| **Medications**    | Medication administration and health linkage                                       |
| **Mortality**      | Bird mortality and financial loss tracking                                         |
| **Attendance**     | Daily worker attendance                                                            |
| **Workers**        | Complete worker/HR records                                                         |
| **Staff Accounts** | Admin account and role management                                                  |
| **Expenses**       | Farm expense records and reporting                                                 |
| **Notifications**  | Internal manager/superadmin communication                                          |
| **Reports**        | Cross-module reporting with PDF/Excel export                                       |
| **Global Search**  | Role-filtered cross-module search                                                  |
| **Backup**         | Database export for superadmin                                                     |
| **Orders**         | Public order intake and admin order management                                     |

## Role-Based Access Control

The system has three primary roles:

- **staff**
- **manager**
- **superadmin**

Authorization is enforced at both frontend and backend levels. The frontend controls visibility and navigation, while the backend is the actual security boundary.

| Module         |    Staff    |    Manager    |   Superadmin   |
| -------------- | :---------: | :-----------: | :------------: |
| Dashboard      | ✅ Limited  |  ✅ Limited   |    ✅ Full     |
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

### Important Access Rule

**Workers are restricted to superadmin.** A manager or staff user must receive a backend authorization failure when attempting to access the Workers API directly.

## Security Architecture

### Authentication

JWT authentication protects private API endpoints. The authentication middleware validates the token and attaches the authenticated user to `req.user`.

The authenticated user ID is:

```text
req.user.id
```

### Role Authorization

Restricted routes use `protect` together with `allowRoles(...)`.

Example:

```js
router.get("/", protect, allowRoles("superadmin"), getWorkers);
```

### Frontend Protection

The frontend uses protected routes and role-aware navigation. Restricted sidebar links are hidden from unauthorized roles.

Frontend hiding is only a UX layer; backend authorization remains mandatory.

### Soft Delete

Applicable modules use deletion metadata such as:

```text
isDeleted
deletedAt
deletedBy
```

Restore operations are restricted to authorized roles.

### Financial Security

Price-sensitive transactions are recalculated and validated on the server. The backend does not blindly trust totals or prices submitted by the browser.

## Architectural Conventions

- Import authentication helpers from `middleware/authMiddleware.js` using `{ protect, allowRoles }`.
- Use `req.user.id` for the authenticated user ID.
- Use soft-delete metadata rather than destructive deletion where the module supports it.
- Register `/deleted` routes before `/:id` routes where both exist.
- Whitelist fields accepted by update endpoints instead of blindly passing `req.body` to database updates.
- Use the shared `apiClient.js` for frontend API requests.
- Use `req.app.get("io")` for Socket.IO access from controllers.
- Keep shared constants synchronized between frontend and backend.
- Re-validate price-sensitive line items server-side.

## Egg Sales Pricing

Mebrek Farms uses five egg categories:

| Egg Category | Price per Crate |
| ------------ | --------------: |
| **Big**      |          ₦5,000 |
| **Jumbo**    |          ₦5,800 |
| **Turkey**   |          ₦6,000 |
| **Normal**   |          ₦4,900 |
| **Small**    |          ₦4,000 |

A customer can purchase any combination of these categories in **one transaction and one invoice**. Each category is represented as a line item and the server calculates the combined amount.

## Real-Time Communication

Socket.IO provides real-time functionality for:

- Notifications.
- Messaging.
- Live notification counts.
- Real-time updates between connected users.

## Exports and Invoicing

### PDF

Used for invoices and printable reports through:

- `jsPDF`
- `jspdf-autotable`

### Excel

Used for reporting and data export through:

- `SheetJS / xlsx`

## Testing and Production Readiness

Before active deployment, test the system separately as **staff**, **manager**, and **superadmin**.

### Authentication Tests

- Valid login succeeds.
- Invalid credentials are rejected.
- Missing JWT is rejected.
- Invalid/expired JWT is rejected.
- Logout/session clearing works correctly.

### Authorization Tests

For every restricted module:

1. Test normal access with the permitted role.
2. Test frontend route access with an unauthorized role.
3. Manually call the backend endpoint as an unauthorized role.
4. Confirm the backend returns `403 Forbidden`.

Example:

```text
GET /api/workers
```

A manager or staff account must not receive worker data.

### CRUD Tests

Verify create, read, update, delete/soft-delete, restore where supported, validation errors, empty states, and refresh/reload behavior.

### Financial Tests

Verify:

- Egg category prices.
- Multiple categories in one sale.
- Discounts.
- Transport charges.
- Amount paid.
- Balance.
- Payment status.
- Invoice generation.
- Daily sales.
- Weekly sales.
- Monthly sales.

## Deployment

Recommended production architecture:

```text
Frontend
   ↓
Vercel / Netlify
   ↓
Production Backend
   ↓
Render / Railway / VPS
   ↓
MongoDB Atlas / Production MongoDB
```

### Frontend

Deploy the Vite frontend to Vercel or Netlify and configure its production API URL.

### Backend

Deploy the Node.js/Express backend to Render, Railway, or a secured VPS and configure production environment variables.

### Database

Use MongoDB Atlas or another secured production MongoDB server.

Never expose database credentials or JWT secrets in frontend code.

## Production Checklist

- [ ] Production MongoDB configured.
- [ ] Production backend deployed.
- [ ] Production frontend deployed.
- [ ] Production environment variables configured.
- [ ] Strong production JWT secret configured.
- [ ] Database credentials secured.
- [ ] Production CORS configured.
- [ ] Superadmin account verified.
- [ ] Manager accounts verified.
- [ ] Staff accounts verified.
- [ ] Role permissions tested.
- [ ] Workers access restricted to superadmin.
- [ ] Reports permissions tested.
- [ ] Egg category prices verified.
- [ ] Sales calculations verified.
- [ ] Invoice generation tested.
- [ ] PDF exports tested.
- [ ] Excel exports tested.
- [ ] Notifications tested.
- [ ] Socket.IO tested.
- [ ] Backup tested.
- [ ] Restore workflows tested.
- [ ] Browser refresh/re-login tested.
- [ ] Mobile/tablet layout checked.
- [ ] Error handling checked.
- [ ] Database indexes verified.
- [ ] Development secrets excluded from Git.

## Maintenance

### Database

- Perform regular backups.
- Monitor database size.
- Review indexes.
- Investigate failed operations.

### Security

- Rotate secrets when required.
- Remove inactive accounts.
- Review roles periodically.
- Keep dependencies updated.
- Monitor unauthorized access attempts.

### Application

- Monitor backend logs.
- Monitor frontend errors.
- Check Socket.IO connections.
- Verify operational workflows.
- Periodically test backup recovery.

### Data Integrity

Pay particular attention to:

- Sales totals.
- Outstanding balances.
- Production records.
- Mortality records.
- Feed stock.
- Warehouse stock.
- Worker information.

## License

**Proprietary — Internal Use for Mebrek Farms**

This software is intended for Mebrek Farms and its authorized personnel. Unauthorized copying, redistribution, modification, or commercial use is not permitted without appropriate authorization.

## Developer

**Ota Okpogo**

_Developer & System Architect_

**MEBREK FARMS Poultry Farm Management System**

**GitHub:**  
github.com/OtaOkpogo
