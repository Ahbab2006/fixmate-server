# FixMate Server — Backend REST API & Services

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=flat&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.3-black?style=flat&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Native_Driver_v7-47a248?style=flat&logo=mongodb)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout_API-635bff?style=flat&logo=stripe)](https://stripe.com/)
[![Jose](https://img.shields.io/badge/Jose-Remote_JWKS_JWT-blue?style=flat)](https://github.com/panva/jose)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

**FixMate Server** is the core backend RESTful API powering the FixMate home service ecosystem. Built with Express 5, native MongoDB Atlas drivers, and ES Modules, the server handles booking state machines, service lifecycle moderation, role-based access control (RBAC), and automated Stripe Checkout session creation and payment verification.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Backend Responsibilities & Features](#2-backend-responsibilities--features)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Project Folder Structure](#5-project-folder-structure)
6. [Installation & Local Setup](#6-installation--local-setup)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [MongoDB Atlas Configuration](#8-mongodb-atlas-configuration)
9. [Better Auth & JWT Verification](#9-better-auth--jwt-verification)
10. [API Documentation](#10-api-documentation)
    - [Root & Health Check](#root--health-check)
    - [Services API](#services-api)
    - [Bookings API](#bookings-api)
    - [Payments API](#payments-api)
    - [User Profile API](#user-profile-api)
    - [Admin & User Management API](#admin--user-management-api)
    - [Test & Diagnostics API](#test--diagnostics-api)
11. [Authorization & Role-Based Access Control](#11-authorization--role-based-access-control)
12. [Stripe Checkout & Payment Verification](#12-stripe-checkout--payment-verification)
13. [Payment Configuration & Currency Policy](#13-payment-configuration--currency-policy)
14. [Error Handling & Security](#14-error-handling--security)
15. [Development & Production Commands](#15-development--production-commands)
16. [Deployment Guide (Render)](#16-deployment-guide-render)
17. [Related Repositories & Live Project Links](#17-related-repositories--live-project-links)

---

## 1. Project Overview

The FixMate backend provides an audited, role-protected interface for customers, service technicians, and platform administrators. It manages the full lifecycle of home repair jobs: from customer request generation, technician dispatch, and step-by-step repair status progression to final quote invoicing and Stripe Checkout settlement.

---

## 2. Backend Responsibilities & Features

- **Decoupled Architecture:** Serves as a standalone API layer receiving requests from the Next.js frontend client.
- **Service Catalog Management:** Manages repair offerings with filtering by 7 core categories (`Smartphone`, `Laptop & PC`, `AC`, `Refrigerator`, `TV`, `Washing Machine`, `Electrical`), mode (`Home Visit`, `Shop Drop-off`), and price sorting.
- **Service Moderation Pipeline:** Requires administrators to review and approve newly published services before they appear in the public catalog.
- **Strict Booking State Machine:** Enforces valid status transitions:
  - `requested` &rarr; `accepted` OR `rejected`
  - `accepted` &rarr; `in-progress`
  - `in-progress` &rarr; `completed` (with mandatory final amount)
  - `requested` &rarr; `cancelled` (customer-initiated prior to acceptance)
- **Stripe Checkout & Invoicing:** Dynamically constructs Stripe Checkout sessions with line items and performs server-side receipt reconciliation against the Stripe API.
- **Cross-Service JWT Verification:** Decodes and validates tokens issued by the frontend's Better Auth engine using asynchronous remote JSON Web Key Sets (JWKS).
- **Automated Database Indexing:** Automatically builds compound and unique database indexes on startup.

---

## 3. Technology Stack

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime** | [Node.js](https://nodejs.org/) | `>=18.0.0` (v20+ recommended) | JavaScript server runtime |
| **Framework** | [Express](https://expressjs.com/) | `^5.3.0` | HTTP routing and middleware framework |
| **Database** | [MongoDB Native Driver](https://www.mongodb.com/) | `^7.9.0` | Native collection queries, aggregation, and index automation |
| **Token Security** | [jose](https://github.com/panva/jose) | `^6.2.17` | Remote JWKS retrieval and cryptographic JWT verification |
| **Payments** | [Stripe SDK](https://stripe.com/) | `^23.1.0` | Checkout session creation and session retrieval verification |
| **Security & CORS** | [cors](https://www.npmjs.com/package/cors), [helmet](https://helmetjs.github.io/) | `^2.8.6`, `^8.3.0` | HTTP security headers and cross-origin resource sharing |
| **Environment** | [dotenv](https://www.npmjs.com/package/dotenv) | `^18.0.10` | Environment variable management |
| **Development** | [nodemon](https://nodemon.io/) | `^3.1.14` | Hot-reloading development server |

---

## 4. System Architecture

```mermaid
flowchart TD
    Client["FixMate Client (Next.js / Better Auth)"]
    Server["FixMate Server (Express 5 REST API)"]
    DB[("MongoDB Atlas ('fix-mate' Database)")]
    StripeAPI["Stripe API (Checkout Sessions)"]
    JWKS["Client JWKS Endpoint (/api/auth/jwks)"]

    Client -- "Bearer <JWT>" --> Server
    Server -- "Validate Issuer & Audience" --> JWKS
    Server -- "Native Driver Queries" --> DB
    Server -- "Create / Verify Checkout" --> StripeAPI
```

1. **Authentication:** The client logs users in via Better Auth, generating a signed JWT token containing user identity and role.
2. **API Requests:** Client makes requests containing `Authorization: Bearer <token>`.
3. **Verification:** Server fetches public keys from `${BETTER_AUTH_URL}/api/auth/jwks` using `jose` to verify cryptographic authenticity.
4. **Database Operations:** Native MongoDB driver operations execute against collections: `user`, `services`, `bookings`, and `payments`.
5. **Payment Cycle:** Server coordinates with Stripe API in USD, validating returned sessions before marking bookings as paid.

---

## 5. Project Folder Structure

```text
fixmate-server/
├── config/
│   ├── db.js                 # MongoDB client connection & index initialization
│   └── stripe.js             # Stripe SDK client initialization
├── controllers/
│   ├── bookingController.js  # Booking creation, updates, cancellation, listing
│   ├── paymentController.js  # Stripe Checkout creation, verification, revenue stats
│   ├── serviceController.js  # Service publishing, catalog filters, admin approval
│   └── userController.js     # User profile retrieval, update, user role management
├── middleware/
│   ├── verifyRole.js         # Role-based authorization middleware (RBAC)
│   └── verifyToken.js        # Remote JWKS token verification middleware
├── routes/
│   ├── bookingRoutes.js      # Booking endpoints (/api/bookings)
│   ├── paymentRoutes.js      # Payment endpoints (/api/payments)
│   ├── serviceRoutes.js      # Service endpoints (/api/services)
│   └── userRoutes.js        # Profile and user endpoints (/api/users)
├── .gitignore                # Git ignore rules (.env, node_modules, logs)
├── index.js                  # Application entry point & Express server bootstrap
├── package.json              # Scripts, module type: "module", dependencies
└── README.md                 # Server documentation
```

---

## 6. Installation & Local Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher (v20+ recommended).
- **npm** (bundled with Node.js).
- **MongoDB Atlas** database cluster (or local MongoDB).
- **FixMate Client** running locally (or hosted) to provide JWKS endpoints.
- **Stripe Account** with access to Secret Keys in Test Mode.

### Step-by-Step Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ahbab2006/fixmate-server.git
   cd fixmate-server
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```bash
   touch .env
   ```
   Add the required variable names listed in the [Environment Variables Reference](#7-environment-variables-reference).

4. **Verify MongoDB & Client accessibility:**
   Ensure your MongoDB Atlas cluster allows incoming connections from your IP address, and ensure your client application is running to respond to JWKS requests.

5. **Start the local server:**
   ```bash
   npm run dev
   ```
   The console will output:
   ```text
   MongoDB Connected Successfully!
   Database Indexes Created Successfully!
   FixMate Server running on port 5000
   ```

---

## 7. Environment Variables Reference

Create a `.env` file in the project root with the following configuration keys. **Never commit `.env` or disclose secret values.**

| Variable Name | Required | Description / Local Value Example |
| :--- | :---: | :--- |
| `PORT` | Optional | Port for the Express server (defaults to `5000` if omitted; Render assigns this dynamically) |
| `MONGODB_URI` | **Yes** | Full MongoDB connection string (e.g., `mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority`) |
| `BETTER_AUTH_URL` | **Yes** | Base URL of the client hosting Better Auth JWKS (e.g., `http://localhost:3000` or production Vercel URL) |
| `CLIENT_URL` | **Yes** | Base URL of the client frontend for Stripe success/cancel redirects (e.g., `http://localhost:3000`) |
| `STRIPE_SECRET_KEY` | **Yes** | Stripe secret API key (starts with `sk_test_...` for test mode or `sk_live_...` for live mode) |
| `STRIPE_WEBHOOK_SECRET` | Optional (Dev) / **Yes** (Prod) | Stripe webhook endpoint signing secret (starts with `whsec_...`) used to cryptographically verify incoming Stripe event signatures (Assignment Challenge 4) |

---

## 8. MongoDB Atlas Configuration

The server targets the database named **`fix-mate`** using the native driver (`client.db("fix-mate")`).

### Network Access
Because cloud hosts (such as Render or Vercel) allocate dynamic IP addresses, you must configure network access in MongoDB Atlas:
1. Navigate to **Security > Network Access**.
2. Click **Add IP Address**.
3. Add `0.0.0.0/0` (**Allow Access From Anywhere**) or configure private peering.

### Automated Indexes
When `connectToMongoDB()` runs in `config/db.js`, `initializeDatabase()` automatically creates the following database indexes:

| Collection | Indexed Field(s) | Index Name | Options | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`user`** | `email: 1` | `user_email_unique` | `unique: true` | Fast user lookup & duplicate prevention |
| **`services`** | `technicianEmail: 1` | `service_technician_email` | Standard | Technician portfolio filtering |
| **`services`** | `category: 1` | `service_category` | Standard | Category search optimization |
| **`services`** | `approvalStatus: 1` | `service_approval_status` | Standard | Admin approval querying |
| **`bookings`** | `customerEmail: 1` | `booking_customer_email` | Standard | Customer booking history lookup |
| **`bookings`** | `technicianEmail: 1` | `booking_technician_email` | Standard | Technician request queue retrieval |
| **`bookings`** | `serviceId: 1` | `booking_service_id` | Standard | Booking-to-service mapping |
| **`bookings`** | `status: 1` | `booking_status` | Standard | State filtering (`requested`, `completed`, etc.) |
| **`payments`** | `bookingId: 1` | `payment_booking_unique` | `unique: true` | Prevents double-payment for a booking |
| **`payments`** | `stripeSessionId: 1` | `payment_stripe_session_unique` | `unique: true` | Prevents duplicate Stripe session recording |

---

## 9. Better Auth & JWT Verification

The backend shares user identities with the Next.js client without managing independent session storage.

### Middleware Implementation (`middleware/verifyToken.js`)
```javascript
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS = createRemoteJWKSet(
    new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);
```

### Verification Flow
1. Extracts the token from the `Authorization: Bearer <token>` header.
2. Retrieves public signing keys from `${BETTER_AUTH_URL}/api/auth/jwks`.
3. Validates the signature, expiration, and exact matching of:
   - `issuer: process.env.BETTER_AUTH_URL`
   - `audience: process.env.BETTER_AUTH_URL`
4. Injects decoded payload into `req.user`:
   ```javascript
   req.user = {
     id: "user_id_string",
     email: "user@example.com",
     role: "customer" // or "technician" | "admin"
   };
   ```

> [!IMPORTANT]
> `BETTER_AUTH_URL` on the server must match the client's `BETTER_AUTH_URL` character-for-character (including protocol and trailing-slash rules). Any mismatch causes token rejection with `401 Unauthorized`.

---

## 10. API Documentation

All protected routes require the header:
```http
Authorization: Bearer <JWT_TOKEN>
```

### Root & Health Check

#### `GET /`
- **Access:** Public
- **Description:** Verifies server runtime availability.
- **Response:**
  ```text
  FixMate Server is Running!
  ```

---

### Services API (`/api/services`)

#### `GET /api/services`
- **Access:** Public
- **Description:** Returns all approved and available services for customer browsing.
- **Query Parameters:**
  - `search` *(string)*: Searches title and description case-insensitively.
  - `category` *(string)*: Filters by category (`Smartphone`, `Laptop & PC`, `AC`, `Refrigerator`, `TV`, `Washing Machine`, `Electrical`).
  - `serviceMode` *(string)*: `Home Visit` or `Shop Drop-off`.
  - `sort` *(string)*: `newest` (default), `price-low`, `price-high`.
- **Response `200`:**
  ```json
  {
    "success": true,
    "totalServices": 12,
    "services": [
      {
        "_id": "6740b2f...",
        "title": "Smartphone Screen & Battery Repair",
        "category": "Smartphone",
        "description": "Professional OLED screen replacement...",
        "image": "https://i.ibb.co/...",
        "basePrice": 45,
        "estimatedDuration": "1-2 hours",
        "serviceMode": "Home Visit",
        "serviceArea": "Downtown",
        "technicianName": "John Doe",
        "technicianEmail": "tech@example.com",
        "approvalStatus": "approved",
        "isAvailable": true,
        "createdAt": "2026-11-20T10:00:00.000Z"
      }
    ]
  }
  ```

#### `GET /api/services/:id`
- **Access:** Public
- **Description:** Retrieves full details for a single service.
- **Response `200`:**
  ```json
  {
    "success": true,
    "service": { ... }
  }
  ```

#### `GET /api/services/my-services`
- **Access:** Technician Only
- **Description:** Retrieves all services published by the authenticated technician.
- **Response `200`:**
  ```json
  {
    "success": true,
    "totalServices": 3,
    "services": [ ... ]
  }
  ```

#### `POST /api/services`
- **Access:** Technician Only
- **Description:** Submits a new repair service for administrative moderation.
- **Request Body:**
  ```json
  {
    "title": "AC Master Deep Cleaning",
    "category": "AC",
    "description": "Complete indoor and outdoor unit jet cleaning.",
    "image": "https://i.ibb.co/example.jpg",
    "basePrice": 65,
    "estimatedDuration": "2 hours",
    "serviceMode": "Home Visit",
    "serviceArea": "North Zone"
  }
  ```
- **Response `201`:**
  ```json
  {
    "success": true,
    "message": "Service created successfully. Waiting for admin approval.",
    "serviceId": "6740b3c..."
  }
  ```

#### `PUT /api/services/:id`
- **Access:** Technician Only
- **Description:** Updates an existing service. *Resets `approvalStatus` back to `pending`.*
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "Service updated successfully. Waiting for admin approval."
  }
  ```

#### `PATCH /api/services/:id/availability`
- **Access:** Technician Only
- **Description:** Toggles whether the service is accepting bookings (`isAvailable`).
- **Request Body:**
  ```json
  {
    "isAvailable": false
  }
  ```
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "Service disabled successfully."
  }
  ```
  *(Returns `"Service enabled successfully."` when `isAvailable: true`)*

#### `DELETE /api/services/:id`
- **Access:** Technician Only
- **Description:** Deletes a service owned by the authenticated technician.
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "Service deleted successfully."
  }
  ```

#### `GET /api/services/admin/services`
- **Access:** Admin Only
- **Query Parameters:**
  - `approvalStatus` *(string)*: `pending` (default), `approved`, `rejected`, or `all`.
- **Response `200`:**
  ```json
  {
    "success": true,
    "totalServices": 24,
    "approvalStatus": "pending",
    "services": [ ... ]
  }
  ```

> [!NOTE]
> The route alias `GET /api/services/admin/pending` is also available for backward compatibility.

#### `GET /api/services/admin/stats`
- **Access:** Admin Only
- **Description:** Aggregates service approval statistics.
- **Response `200`:**
  ```json
  {
    "success": true,
    "stats": {
      "totalServices": 30,
      "approvedServices": 25,
      "pendingServices": 3,
      "rejectedServices": 2
    }
  }
  ```

#### `PATCH /api/services/admin/:id/approval`
- **Access:** Admin Only
- **Request Body:**
  ```json
  {
    "approvalStatus": "approved" // or "rejected"
  }
  ```
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "Service approved successfully."
  }
  ```
  *(Or `"Service rejected successfully."` when `approvalStatus: "rejected"`)*

---

### Bookings API (`/api/bookings`)

#### `POST /api/bookings`
- **Access:** Customer Only
- **Description:** Creates a new booking request. Verifies that the service is approved and available, that the customer is not booking their own service, and that no active duplicate request exists.
- **Request Body:**
  ```json
  {
    "serviceId": "6740b2f...",
    "customerPhone": "+15551234567",
    "address": "742 Evergreen Terrace",
    "preferredDate": "2026-11-25",
    "problemDescription": "The air conditioner is leaking water inside the living room."
  }
  ```
- **Validation Rules:**
  - `problemDescription`: Minimum 20 characters.
  - `preferredDate`: Today or future date.
- **Response `201`:**
  ```json
  {
    "success": true,
    "message": "Repair request submitted successfully.",
    "bookingId": "6740c4a..."
  }
  ```

#### `GET /api/bookings/my-bookings`
- **Access:** Customer Only
- **Description:** Retrieves all bookings submitted by the customer.
- **Response `200`:**
  ```json
  {
    "success": true,
    "totalBookings": 4,
    "bookings": [ ... ]
  }
  ```

#### `PATCH /api/bookings/:id/cancel`
- **Access:** Customer Only
- **Description:** Cancels an unaccepted booking (`status: "requested"` &rarr; `"cancelled"`).
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "Booking request cancelled successfully."
  }
  ```

#### `GET /api/bookings/technician`
- **Access:** Technician Only
- **Description:** Retrieves booking requests assigned to the authenticated technician.
- **Response `200`:**
  ```json
  {
    "success": true,
    "totalBookings": 8,
    "bookings": [ ... ]
  }
  ```

#### `PATCH /api/bookings/:id/status`
- **Access:** Technician Only
- **Description:** Advances the booking state machine.
- **Request Body Examples:**
  - *Accepting Job:* `{"status": "accepted"}`
  - *Rejecting Job:* `{"status": "rejected"}`
  - *Starting Repair:* `{"status": "in-progress"}`
  - *Completing Job:* `{"status": "completed", "finalAmount": 75.00}`
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "Booking completed successfully."
  }
  ```

#### `GET /api/bookings/admin/all`
- **Access:** Admin Only
- **Description:** Retrieves all system bookings across all statuses and users.
- **Response `200`:**
  ```json
  {
    "success": true,
    "totalBookings": 120,
    "bookings": [ ... ]
  }
  ```

---

### Payments API (`/api/payments`)

#### `POST /api/payments/create-checkout-session`
- **Access:** Customer Only
- **Description:** Generates a hosted Stripe Checkout URL for a completed booking in USD (`$`).
- **Validation:**
  - Booking must exist and belong to the requesting customer.
  - Booking status must be `completed`.
  - Booking must be `paymentStatus: "unpaid"`.
  - Booking must have a valid positive `finalAmount`.
- **Request Body:**
  ```json
  {
    "bookingId": "6740c4a..."
  }
  ```
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "Checkout session created successfully.",
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
  }
  ```

#### `POST /api/payments/verify-checkout-session`
- **Access:** Customer Only
- **Description:** Verifies payment completion after customer returns to `/payment/success?session_id=...`. Retrieves the session directly from Stripe, verifies amount and currency (`usd`), prevents duplicate recording, marks booking `paymentStatus: "paid"`, and records a new payment in `payments`.
- **Request Body:**
  ```json
  {
    "sessionId": "cs_test_a1b2c3d4..."
  }
  ```
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "Payment verified and saved successfully.",
    "payment": {
      "bookingId": "6740c4a...",
      "stripeSessionId": "cs_test_a1b2c3d4...",
      "transactionId": "pi_3MtwLw2eZvKYlo2C01234567",
      "paymentIntentId": "pi_3MtwLw2eZvKYlo2C01234567",
      "customerName": "Jane Doe",
      "customerEmail": "jane@example.com",
      "technicianName": "John Doe",
      "technicianEmail": "tech@example.com",
      "serviceTitle": "AC Master Deep Cleaning",
      "amount": 75.00,
      "currency": "usd",
      "paymentStatus": "paid",
      "paidAt": "2026-11-20T12:30:00.000Z",
      "createdAt": "2026-11-20T12:30:00.000Z"
    }
  }
  ```

#### `POST /api/payments/webhook`
- **Access:** Public (Stripe Webhook caller verified cryptographically via `stripe-signature` header)
- **Description:** Asynchronous webhook endpoint (Assignment Challenge 4). Cryptographically validates incoming Stripe event signatures using `STRIPE_WEBHOOK_SECRET` and `stripe.webhooks.constructEvent`. Processes `checkout.session.completed` events, updates the booking to `paymentStatus: "paid"`, and idempotently records the transaction in the `payments` collection.
- **Headers:**
  - `Content-Type: application/json`
  - `stripe-signature: t=<timestamp>,v1=<signature>`
- **Request Body:** Pristine raw JSON buffer (excluded from global `express.json()` and captured via `express.raw({ type: "application/json" })`).
- **Events Handled:**
  - `checkout.session.completed`: Verifies `payment_status === "paid"`, extracts `bookingId` from `session.metadata`, validates booking existence and amount matching in USD (`usd`), idempotently inserts payment document, and marks booking `paymentStatus: "paid"`.
  - All other Stripe event types: Safely acknowledged and logged with `{ "received": true }` to maintain healthy webhook delivery telemetry.
- **Response `200`:**
  ```json
  {
    "received": true,
    "message": "Payment verified and booking updated successfully."
  }
  ```
- **Response `400`:**
  ```json
  {
    "received": false,
    "message": "Webhook signature verification failed: ..."
  }
  ```

#### `GET /api/payments/my-payments`
- **Access:** Customer Only
- **Description:** Retrieves the customer's personal payment history and lifetime expenditure.
- **Response `200`:**
  ```json
  {
    "success": true,
    "totalPayments": 3,
    "totalAmount": 215.50,
    "payments": [ ... ]
  }
  ```

#### `GET /api/payments/admin/all`, `GET /api/payments/admin/payments` & `GET /api/admin/payments`
- **Access:** Admin Only
- **Description:** Returns all platform transactions and total collected revenue across all three route aliases.
- **Response `200`:**
  ```json
  {
    "success": true,
    "totalPayments": 48,
    "totalRevenue": 3840.00,
    "payments": [ ... ]
  }
  ```

---

### User Profile API (`/api/users`)

#### `GET /api/users/profile`
- **Access:** Authenticated User (Any role)
- **Description:** Returns profile metadata for the authenticated user from the `user` collection.
- **Response `200`:**
  ```json
  {
    "success": true,
    "profile": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "customer",
      "image": "https://i.ibb.co/avatar.jpg",
      "phone": "+15559876543",
      "area": "Uptown",
      "bio": "Homeowner looking for quick appliance fixes.",
      "createdAt": "2026-11-15T08:00:00.000Z"
    }
  }
  ```

#### `PATCH /api/users/profile`
- **Access:** Authenticated User
- **Description:** Updates profile fields (`name`, `phone`, `area`, `bio`, `image`).
- **Request Body (Partial updates supported):**
  ```json
  {
    "name": "Jane Doe",
    "phone": "+15559876543",
    "area": "Westside",
    "bio": "Updated bio text."
  }
  ```
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "Profile updated successfully.",
    "profile": { ... }
  }
  ```

---

### Admin & User Management API (`/api/users`)

#### `GET /api/users`
- **Access:** Admin Only
- **Description:** Lists all registered users on the platform.
- **Response `200`:**
  ```json
  {
    "success": true,
    "totalUsers": 50,
    "users": [
      {
        "_id": "673f8a...",
        "name": "Bob Smith",
        "email": "bob@example.com",
        "role": "technician",
        "image": null,
        "createdAt": "2026-11-18T09:00:00.000Z"
      }
    ]
  }
  ```

#### `PATCH /api/users/:id/role`
- **Access:** Admin Only
- **Description:** Modifies a user's role. *Admins cannot change their own role.*
- **Request Body:**
  ```json
  {
    "role": "technician" // "customer" | "technician" | "admin"
  }
  ```
- **Response `200`:**
  ```json
  {
    "success": true,
    "message": "User role updated successfully."
  }
  ```

---

### Test & Diagnostics API (`/api/test`)

The backend provides token and role authorization test endpoints for development and diagnostic verification:

#### `GET /api/test/protected`
- **Access:** Authenticated User (Any role with a valid Bearer token)
- **Response `200`:**
  ```json
  {
    "message": "Authentication successful!",
    "user": {
      "id": "user_id_string",
      "email": "user@example.com",
      "role": "customer"
    }
  }
  ```

#### `GET /api/test/customer`
- **Access:** Customer Only (`role: "customer"`)
- **Response `200`:**
  ```json
  {
    "message": "Customer access granted!"
  }
  ```

#### `GET /api/test/admin`
- **Access:** Admin Only (`role: "admin"`)
- **Response `200`:**
  ```json
  {
    "message": "Admin access granted!"
  }
  ```

---

## 11. Authorization & Role-Based Access Control

Role verification is handled by higher-order middleware defined in `middleware/verifyRole.js`:

```javascript
export function verifyRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: "Access denied! User role not found." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden! You do not have permission." });
    }
    next();
  };
}
```

### Access Matrix

| Endpoint Area | Public | Customer | Technician | Admin |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/services` (Catalog) | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| `POST /api/services` (Create) | :x: | :x: | :white_check_mark: | :x: |
| `PATCH /api/services/admin/*` | :x: | :x: | :x: | :white_check_mark: |
| `POST /api/bookings` | :x: | :white_check_mark: | :x: | :x: |
| `GET /api/bookings/technician` | :x: | :x: | :white_check_mark: | :x: |
| `PATCH /api/bookings/:id/status` | :x: | :x: | :white_check_mark: | :x: |
| `POST /api/payments/create-checkout-session` | :x: | :white_check_mark: | :x: | :x: |
| `POST /api/payments/verify-checkout-session` | :x: | :white_check_mark: | :x: | :x: |
| `GET /api/payments/admin/*` | :x: | :x: | :x: | :white_check_mark: |
| `PATCH /api/users/:id/role` | :x: | :x: | :x: | :white_check_mark: |

---

## 12. Stripe Checkout & Payment Verification

FixMate implements a high-reliability dual-confirmation payment architecture:
1. **Synchronous Direct Verification:** When the customer completes payment on Stripe Checkout and returns to `/payment/success?session_id=...`, the client triggers `POST /api/payments/verify-checkout-session` for instantaneous UX feedback.
2. **Asynchronous Stripe Webhook (Assignment Challenge 4):** As an automated safeguard, Stripe dispatches `checkout.session.completed` events directly to `POST /api/payments/webhook`, ensuring bookings are settled even if the user closes their browser before redirecting.

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Frontend as FixMate Client
    participant Backend as FixMate Server
    participant Stripe as Stripe API & Webhooks
    participant DB as MongoDB Atlas

    Customer->>Frontend: Click "Pay Now" on completed booking
    Frontend->>Backend: POST /api/payments/create-checkout-session { bookingId }
    Backend->>DB: Verify booking completed & unpaid
    Backend->>Stripe: stripe.checkout.sessions.create({ currency: 'usd', metadata: { bookingId } })
    Stripe-->>Backend: Return session URL
    Backend-->>Frontend: { checkoutUrl: session.url }
    Frontend->>Stripe: Redirect to Stripe Hosted Checkout
    Customer->>Stripe: Submits payment

    par Path A: Synchronous Return
        Stripe-->>Frontend: Redirect to /payment/success?session_id=cs_...
        Frontend->>Backend: POST /api/payments/verify-checkout-session { sessionId }
        Backend->>Stripe: stripe.checkout.sessions.retrieve(sessionId)
        Backend->>DB: Record payment & update booking to 'paid' (Idempotent)
        Backend-->>Frontend: { success: true, payment }
        Frontend-->>Customer: Display Verified Payment Receipt
    and Path B: Asynchronous Webhook (Challenge 4)
        Stripe->>Backend: POST /api/payments/webhook [checkout.session.completed]
        Note over Backend: Cryptographically verifies signature with STRIPE_WEBHOOK_SECRET
        Backend->>DB: Record payment & update booking to 'paid' (Idempotent)
        Backend-->>Stripe: HTTP 200 { received: true }
    end
```

### Safety, Idempotency & Double-Payment Guards
1. **Database Lockouts:** Bookings marked `paymentStatus: "paid"` are rejected by `createCheckoutSession` with a `409 Conflict`.
2. **Session Verification Matching:** Both `verifyCheckoutSession` and `handleStripeWebhook` validate that `session.amount_total` matches `Math.round(booking.finalAmount * 100)` and that currency is strictly `"usd"`.
3. **Compound Unique Indexes:** MongoDB Atlas enforces `unique: true` on both `payments.bookingId` (`payment_booking_unique`) and `payments.stripeSessionId` (`payment_stripe_session_unique`). If Path A and Path B execute simultaneously, one succeeds and the other encounters a duplicate key error (`E11000`), which is safely intercepted, treated as idempotent success, and returned with HTTP 200.
4. **Raw Body Preservation:** The Express server is architected so that `POST /api/payments/webhook` bypasses global `express.json()` and uses `express.raw({ type: "application/json" })`. This guarantees byte-for-byte HMAC SHA-256 signature verification matching with Stripe's signing secret.

### Local Webhook Testing via Stripe CLI
To test Stripe webhooks locally during development:
1. Install the official [Stripe CLI](https://docs.stripe.com/stripe-cli).
2. Authenticate the CLI with your Stripe account:
   ```bash
   stripe login
   ```
3. Start forwarding webhook events to your local FixMate server:
   ```bash
   stripe listen --forward-to localhost:5000/api/payments/webhook
   ```
4. Copy the webhook signing secret printed by the CLI (e.g., `whsec_...`) and set it in your `fixmate-server/.env` file:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_forwarding_secret
   ```
5. Trigger a test event or complete a test checkout in the client:
   ```bash
   stripe trigger checkout.session.completed
   ```

### Production Stripe Dashboard Webhook Configuration
To configure webhooks on the production backend (e.g., Render):
1. Log in to the [Stripe Dashboard](https://dashboard.stripe.com/).
2. In the top right, ensure you are in **Test Mode** (or Live Mode when launching).
3. Navigate to **Developers > Webhooks**.
4. Click **Add endpoint**.
5. Set the **Endpoint URL** to:
   ```text
   https://fixmate-server-mt4l.onrender.com/api/payments/webhook
   ```
6. Click **+ Select events** and select:
   - `checkout.session.completed`
7. Click **Add endpoint**.
8. Under the **Signing secret** section, click **Reveal** to copy the signing secret (`whsec_...`).
9. Add the secret to your production hosting environment (e.g., Render Environment Variables):
   - Key: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_...`
10. Trigger a deployment or restart the server on Render to apply the variable.

---

## 13. Payment Configuration & Currency Policy

### Target Customer Markets
The FixMate platform is specifically designed to service repair customers in:
- **United States (US)**
- **Bangladesh (BD)**

### Standard & Recommended Currency: USD ($)
- **Universal Pricing Standard:** All financial amounts—including service starting prices, quotes, technician final invoicing, Stripe Checkout sessions, and stored payment receipts—are denominated in **USD (`usd` / `$`)**.
- **Cross-Border Card Settlement:** Whether a customer books from the US or Bangladesh, transactions are processed in USD. International payment cards (Visa, MasterCard, American Express) automatically handle currency conversion according to the customer's issuing bank exchange rate.

### Stripe Test Mode Guidance
For development and staging environments:
1. Ensure your `.env` contains test credentials (`STRIPE_SECRET_KEY=sk_test_...`).
2. Simulate transactions with official Stripe test card numbers:
   - **Success Card:** `4242 •••• •••• 4242`, Expiry: *Any future date*, CVC: *Any 3 digits*.
   - **Declined Card:** `4000 •••• •••• 0002`.

### Merchant Account Availability & Payout Notice
- **Stripe Merchant Eligibility:** Direct Stripe merchant accounts and bank payouts are subject to Stripe’s country-by-country eligibility guidelines.
- **Regional Onboarding Notice:** *Direct merchant onboarding on Stripe is supported for businesses registered in eligible countries (e.g., the United States). Stripe does not currently offer direct merchant onboarding for individual bank accounts domiciled in Bangladesh without an eligible international business entity.*

---

## 14. Error Handling & Security

- **HTTP Status Standards:** Consistent use of standard HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `500 Internal Server Error`).
- **Input Sanitization & Validation:** Regex validation on MongoDB ObjectIds (`/^[0-9a-fA-F]{24}$/`), positive number checks on currency amounts, and date boundary checks.
- **SQL / NoSQL Injection Resistance:** Uses parameter-driven MongoDB driver methods rather than unescaped string concatenation.
- **Sensitive Data Filtering:** User projections omit internal authentication password hashes and private credentials.

---

## 15. Development & Production Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Installs dependencies |
| `npm run dev` | Starts server with `nodemon` hot reloading on port 5000 |
| `npm start` | Starts server for production execution (`node index.js`) |

---

## 16. Deployment Guide (Render)

### Step 1: Create a Render Web Service
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** &rarr; **Web Service**.
3. Connect your repository: `https://github.com/Ahbab2006/fixmate-server`.

### Step 2: Configure Service Settings
- **Name:** `fixmate-server`
- **Region:** Choose the region nearest to your MongoDB Atlas cluster (e.g., Oregon / Ohio).
- **Branch:** `master`
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

### Step 3: Configure Environment Variables in Render
Under the **Environment** tab, add the following key-value pairs:

| Key | Value Description |
| :--- | :--- |
| `NODE_VERSION` | `20` *(Ensures Node.js 20 LTS runtime)* |
| `MONGODB_URI` | Full MongoDB Atlas connection string |
| `BETTER_AUTH_URL` | Exact URL of the production Vercel client (`https://<client-name>.vercel.app`) |
| `CLIENT_URL` | Exact URL of the production Vercel client (`https://<client-name>.vercel.app`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` or `sk_live_...`) |

> [!TIP]
> Once deployed, copy your Render assigned service URL (e.g. `https://fixmate-server.onrender.com`) and paste it as `NEXT_PUBLIC_API_URL` in the frontend Vercel project settings, then trigger a frontend redeployment.

---

## 17. Related Repositories & Live Project Links

- **Frontend Client Repository:** [https://github.com/Ahbab2006/fixmate-client](https://github.com/Ahbab2006/fixmate-client)
- **Backend Server Repository:** [https://github.com/Ahbab2006/fixmate-server](https://github.com/Ahbab2006/fixmate-server)
- **Production Client (Vercel):** [https://fixmate-client-three.vercel.app/](https://fixmate-client-three.vercel.app/) *(Deploy target)*
- **Production Backend (Render):** [https://fixmate-server-mt4l.onrender.com](https://fixmate-server-mt4l.onrender.com) *(Deploy target)*

---

## License

This project is licensed under the [ISC License](LICENSE).
