# MEBREK FARMS

### Poultry Farm Management System

> **A centralized digital management platform for modern poultry farm operations.**

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)](https://github.com/OtaOkpogo)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MongoDB-47A248)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-Private-lightgrey)](https://github.com/OtaOkpogo)

---

## Table of Contents

- [Overview](#overview)
- [Objectives](#objectives)
- [Core Modules](#core-modules)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [User Roles & Access Control](#user-roles--access-control)
- [Security](#security)
- [Worker Management](#worker-management)
- [Production Management](#production-management)
- [Egg Sales Management](#egg-sales-management)
- [Inventory & Warehouse](#inventory--warehouse)
- [Bird Health](#bird-health)
- [Vaccination Management](#vaccination-management)
- [Medication Management](#medication-management)
- [Mortality Tracking](#mortality-tracking)
- [Notifications](#notifications)
- [Dashboard & Analytics](#dashboard--analytics)
- [API Structure](#api-structure)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Production Deployment](#production-deployment)
- [Operational Checklist](#operational-checklist)
- [Backup & Data Protection](#backup--data-protection)
- [Troubleshooting](#troubleshooting)
- [Project Status](#project-status)
- [Developer](#developer)

---

# Overview

**MEBREK FARMS Poultry Farm Management System** is a full-stack web application developed to digitize and centralize the day-to-day management of a poultry farming operation.

The platform replaces fragmented manual record-keeping with a centralized system for managing:

- Farm production
- Poultry health
- Vaccinations
- Medications
- Mortality
- Workers
- Egg sales
- Warehouse inventory
- Notifications
- Administrative accounts
- Reports and operational analytics

The system is designed around **secure role-based access control**, ensuring that users only have access to the areas of the application appropriate to their responsibilities.

---

# Objectives

The primary objectives of the system are to:

1. Centralize farm records in one application.
2. Reduce dependence on manual paperwork.
3. Improve accuracy of farm records.
4. Simplify monitoring of poultry production.
5. Track egg sales and customer transactions.
6. Monitor inventory and warehouse stock.
7. Maintain organized worker records.
8. Track bird health and treatment activities.
9. Provide management-level operational visibility.
10. Protect sensitive farm information through authentication and authorization.
11. Provide a foundation for reliable reporting and decision-making.

---

# Core Modules

| Module         | Purpose                                     |
| -------------- | ------------------------------------------- |
| Dashboard      | Farm-wide operational overview              |
| Authentication | Secure user login and identity verification |
| Staff Accounts | Administrative account management           |
| Workers        | Employee records and payroll information    |
| Production     | Daily poultry production records            |
| Egg Sales      | Egg sales, invoices and payments            |
| Warehouse      | Inventory and stock management              |
| Bird Health    | Health incidents and follow-up              |
| Vaccinations   | Vaccination schedules and records           |
| Medications    | Medication records                          |
| Mortality      | Bird mortality tracking                     |
| Notifications  | Administrative communication                |
| Reports        | Operational reporting and analysis          |

---

# System Architecture

MEBREK FARMS follows a standard three-layer web application architecture:

```text
┌──────────────────────────────────────────┐
│              USER INTERFACE              │
│                                          │
│        React + Vite + Tailwind CSS       │
│                                          │
└────────────────────┬─────────────────────┘
                     │
                     │ REST API / Socket.IO
                     │
┌────────────────────▼─────────────────────┐
│                BACKEND                   │
│                                          │
│       Node.js + Express + JWT            │
│                                          │
│  Routes → Middleware → Controllers       │
│                       → Services         │
│                                          │
└────────────────────┬─────────────────────┘
                     │
                     │ Mongoose
                     │
┌────────────────────▼─────────────────────┐
│                 DATABASE                 │
│                                          │
│                  MongoDB                 │
│                                          │
└──────────────────────────────────────────┘
```

---

# Technology Stack

## Frontend

- React
- Vite
- JavaScript
- Tailwind CSS
- React Router
- Axios
- Recharts
- Socket.IO Client

## Backend

- Node.js
- Express.js
- Mongoose
- MongoDB
- JSON Web Tokens (JWT)
- bcryptjs
- Socket.IO
- dotenv

## Database

**MongoDB**

MongoDB provides the persistent storage layer for farm records, users, sales, production information, inventory and other operational data.

---

# User Roles & Access Control

The system uses role-based authorization.

## Superadmin

The Superadmin has the highest level of administrative access.

Typical Superadmin capabilities include:

- Dashboard
- Workers
- Production
- Egg Sales
- Warehouse
- Bird Health
- Vaccinations
- Medications
- Mortality
- Notifications
- Staff Accounts
- Reports
- Administrative record recovery where applicable

## Manager

Managers have access to the management functions assigned to their role.

**Worker Management is restricted to Superadmin.**

## Staff

Staff access is restricted according to the permissions assigned to their account.

---

# Security

Security is enforced at the **backend level**, not merely by hiding frontend menu items.

The authentication flow is:

```text
User Login
    │
    ▼
JWT Token
    │
    ▼
Authentication Middleware
    │
    ▼
Role Authorization
    │
    ▼
Protected Controller
    │
    ▼
Database Operation
```

This means that hiding a menu item in React does not constitute the security boundary.

For example, a Manager attempting to manually access a protected Workers API endpoint should receive a `403 Forbidden` response when the endpoint is restricted to Superadmin.

### Security principles

- JWT authentication
- Protected API endpoints
- Role-based authorization
- Password hashing
- Environment-based secrets
- Backend authorization independent of frontend visibility
- Restricted administrative functionality
- Controlled database access

---

# Worker Management

The Workers module provides a centralized employee database.

## Worker Information

Each worker may have:

- Employee ID
- First Name
- Last Name
- Gender
- Phone
- Email
- Address
- Role
- Department
- Employment Type
- Date Hired
- Salary
- Bank Name
- Account Number
- Next of Kin
- Next of Kin Phone
- Employment Status
- Notes

## Worker Analytics

The system provides:

- Total workers
- Active workers
- Inactive workers
- Total payroll
- Average salary
- Highest salary
- Lowest salary
- Department distribution
- Role distribution
- Recently added workers

---

# Production Management

The Production module provides structured daily production records.

Production information includes:

- Date
- Opening stock
- Mortality
- Closing stock
- Sick birds
- Feed consumed
- Water volume
- Drugs used
- Crates produced
- Extra egg pieces
- Total eggs
- Production percentage
- Miscarriage production
- Cracked eggs

Calculated production values provide management with a clearer view of farm performance.

---

# Egg Sales Management

The Egg Sales module manages customer transactions and egg invoices.

## Egg Categories

The farm currently supports five egg categories:

| Category | Price / Crate |
| -------- | ------------: |
| Big      |        ₦5,000 |
| Jumbo    |        ₦5,800 |
| Turkey   |        ₦6,000 |
| Normal   |        ₦4,900 |
| Small    |        ₦4,000 |

A customer can purchase multiple categories within a single transaction.

### Example

```text
Big Eggs       2 crates
Jumbo Eggs     3 crates
Turkey Eggs    1 crate
Normal Eggs    2 crates
Small Eggs     1 crate
```

The system calculates the individual line items and produces one consolidated invoice.

## Sales Features

- Customer records
- Customer phone number
- Invoice generation
- Multiple egg categories per sale
- Crate quantities
- Loose eggs
- Discounts
- Transport charges
- Amount paid
- Outstanding balance
- Payment method
- Payment status
- Sales history
- Soft deletion
- Record restoration for authorized administrators

### Payment Status

```text
Paid
Part Paid
Unpaid
```

---

# Inventory & Warehouse

The Warehouse module provides centralized inventory monitoring.

Inventory records include:

- Item name
- Category
- Quantity
- Unit
- Location
- Low-stock threshold
- Stock status

### Stock Status

```text
IN STOCK
LOW STOCK
OUT OF STOCK
```

The system can therefore help management identify inventory that requires attention.

---

# Bird Health

The Bird Health module records health-related incidents across the farm.

Information may include:

- Date
- Pen / House
- Health issue
- Birds affected
- Symptoms
- Follow-up information

### Health Categories

- Respiratory
- Digestive
- Parasitic
- Bacterial
- Viral
- Nutritional Deficiency
- Injury
- Other

---

# Vaccination Management

The Vaccination module records vaccination activities and schedules.

Information includes:

- Vaccine name
- Bird batch
- Quantity
- Administered by
- Dosage
- Next due date
- Notes

Vaccination schedules can be monitored according to their due dates.

---

# Medication Management

The Medication module provides a structured record of medication activities associated with poultry health management.

Medication records can be used alongside:

- Bird Health
- Vaccination
- Mortality
- Production

This provides a more complete historical picture of flock health.

---

# Mortality Tracking

Mortality records provide visibility into bird losses.

Mortality information can support analysis of:

- Daily losses
- Production performance
- Bird health
- Pen-level issues
- Overall farm performance

---

# Notifications

The notification system provides communication between authorized administrative users.

Features include:

- Notification subjects
- Messages
- Sender information
- Recipient roles
- Per-user read tracking
- Notification replies
- Real-time Socket.IO updates
- Unread notification counts

## Per-user Read Tracking

Notifications use individual read tracking rather than relying on one global read flag.

This prevents the following problem:

```text
Admin A reads notification
        ↓
Notification becomes globally "read"
        ↓
Admin B incorrectly sees it as read
```

Instead:

```text
Notification
     │
     ├── Admin A → Read
     │
     ├── Admin B → Unread
     │
     └── Admin C → Unread
```

This provides more accurate notification behavior for multiple administrators.

---

# Dashboard & Analytics

The dashboard provides a high-level overview of farm operations.

Current dashboard information includes:

- Total workers
- Orders
- Egg crates
- Feed stock
- Mortality
- Production percentage
- Egg production trends
- Mortality trends
- Feed consumption
- Farm overview
- Production summary

Charts are powered by **Recharts**.

---

# API Structure

The backend exposes RESTful API endpoints.

Primary API areas include:

```text
/api/auth
/api/workers
/api/production
/api/eggSales
/api/warehouse
/api/bird-health
/api/vaccinations
/api/medications
/api/notifications
/api/dashboard
```

Protected resources require authentication.

Role-restricted resources additionally require appropriate authorization.

---

# Project Structure

```text
Mebrek-farms/
│
├── backend/
│   │
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   │
│   ├── src/
│   │   ├── admin/
│   │   ├── components/
│   │   ├── services/
│   │   ├── assets/
│   │   └── ...
│   │
│   ├── public/
│   ├── package.json
│   └── .env
│
└── README.md
```

---

# Installation

## Prerequisites

Install the following before setting up the system:

- Node.js
- npm
- MongoDB or MongoDB Atlas
- Git

Verify Node.js:

```bash
node --version
```

Verify npm:

```bash
npm --version
```

---

# Backend Setup

Navigate to the backend:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_secret
```

Start the backend:

```bash
npm start
```

Expected output:

```text
Server running on port 5000
MongoDB connected
```

---

# Frontend Setup

Open a second terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The application should be available at:

```text
http://localhost:5173
```

---

# Environment Configuration

## Backend

Never commit production secrets to source control.

Example:

```env
PORT=5000
MONGO_URI=<MONGODB_CONNECTION_STRING>
JWT_SECRET=<SECURE_RANDOM_SECRET>
```

## Frontend

The frontend API configuration should point to the appropriate backend.

### Development

```text
http://localhost:5000/api
```

### Production

Use the HTTPS URL of the deployed backend.

---

# Production Deployment

The recommended production architecture is:

```text
                    Internet
                       │
              ┌────────▼────────┐
              │     Frontend    │
              │ Vercel/Netlify  │
              └────────┬────────┘
                       │ HTTPS
                       ▼
              ┌─────────────────┐
              │     Backend     │
              │ Render/Railway  │
              │      / VPS      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ MongoDB Atlas   │
              └─────────────────┘
```

## Deployment Steps

1. Create a production MongoDB database.
2. Configure the backend environment variables.
3. Deploy the backend.
4. Confirm the backend is reachable.
5. Configure production CORS.
6. Update the frontend API URL.
7. Build the frontend.
8. Deploy the frontend.
9. Configure production environment variables.
10. Test authentication.
11. Test role permissions.
12. Test all critical farm modules.
13. Verify database connectivity.
14. Verify Socket.IO connections.
15. Perform a final production smoke test.

---

# Operational Checklist

Before handing the system over for daily farm operations:

### Authentication

- [ ] Superadmin login works
- [ ] Manager login works
- [ ] Invalid credentials are rejected
- [ ] Protected pages require authentication
- [ ] JWT authentication works correctly

### Authorization

- [ ] Superadmin can access authorized modules
- [ ] Manager can access authorized modules
- [ ] Manager cannot access Workers
- [ ] Unauthorized API requests return `403`
- [ ] Frontend navigation respects user roles

### Farm Operations

- [ ] Production records can be entered
- [ ] Worker records can be managed
- [ ] Egg sales calculate correctly
- [ ] Multiple egg categories work correctly
- [ ] Warehouse records work correctly
- [ ] Bird Health records work correctly
- [ ] Vaccination records work correctly
- [ ] Medication records work correctly
- [ ] Mortality records work correctly

### Notifications

- [ ] Notifications appear for authorized users
- [ ] Unread count works
- [ ] Read state is per user
- [ ] Replies work
- [ ] Real-time updates work

### Data

- [ ] MongoDB connection is stable
- [ ] Records persist after restart
- [ ] Deleted records behave correctly
- [ ] Restore functionality works where applicable
- [ ] Database backups are configured

---

# Backup & Data Protection

Because the system contains important operational and financial information, database backups should be part of normal farm administration.

Recommended practices:

- Maintain regular MongoDB backups.
- Protect database credentials.
- Never expose database connection strings publicly.
- Never commit `.env` files.
- Use strong administrative passwords.
- Restrict production database access.
- Maintain at least one recoverable backup.

---

# Troubleshooting

## Backend will not start

Check:

```bash
npm install
npm start
```

Verify that:

- MongoDB is available.
- `MONGO_URI` is correct.
- `JWT_SECRET` exists.
- The configured port is available.

---

## Frontend cannot connect to backend

Verify that the backend is running.

Check the frontend API URL and confirm it points to:

```text
http://localhost:5000/api
```

during local development.

---

## `401 Unauthorized`

A `401` response normally indicates an authentication problem.

Check:

- Login credentials
- JWT token
- Authorization header
- Token expiration
- JWT secret configuration

---

## `403 Forbidden`

A `403` response normally indicates that authentication succeeded but the user's role is not authorized to perform the requested operation.

For example:

```text
Manager
   ↓
GET /api/workers
   ↓
403 Forbidden
```

when Workers is restricted to Superadmin.

---

## Socket.IO Connection Errors

If the browser reports:

```text
ERR_CONNECTION_REFUSED
```

for:

```text
/socket.io/
```

verify that the backend server is running and that the frontend is configured to connect to the correct backend URL.

---

# Project Status

**Current Status: Production Ready**

The MEBREK FARMS management system has completed its primary development and security work.

The system is intended to move from development into operational use after the production environment has been configured and the final deployment smoke tests have been completed.

No additional feature development is required for normal farm operation at this stage.

---

# Developer

## Ota Okpogo

**Developer & System Architect**

MEBREK FARMS Poultry Farm Management System

GitHub:
[github.com/OtaOkpogo](https://github.com/OtaOkpogo?utm_source=chatgpt.com)

---

## MEBREK FARMS

**Poultry Farm Management System**

A centralized platform for managing poultry farm operations, records, sales, inventory, workforce, production and administration.

**© 2026 MEBREK FARMS. All rights reserved.**

