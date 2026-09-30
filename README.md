# PropertyOS — Multi-Property Management Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black.svg)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-teal.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20PostGIS-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.x-dc382d.svg)](https://redis.io/)
[![License](https://img.shields.io/badge/License-Proprietary-yellow.svg)]()

> Enterprise-grade, unified multi-property management system engineered specifically for the Indian tenancy ecosystem, providing full-lifecycle support for both **PG / Co-Living Hostels** and **Residential Whole-Unit Rentals**.

---

## 🌟 Overview

**PropertyOS** is a modular, multi-tenant property management platform designed to streamline operations for property owners, landlords, and facility managers. From real-time room/bed inventory to legally enforceable digital agreements and deposit settlements, PropertyOS digitizes every stage of tenancy with zero third-party AI dependencies and 100% deterministic reliability.

---

## 🚀 Key Features

### 1. Dual-Operating Model Architecture
- **PG / Co-Living Facilities**:
  - Interactive multi-floor, room, and bed visual matrices.
  - Multi-sharing room types (Single, Double, Triple, Four-sharing, and Dormitories).
  - Dynamic occupancy tracking, vacancy rates, and bed allocation workflows.
- **Residential Whole-Unit Rentals**:
  - Flats, apartments, villas, and independent houses.
  - Lease agreement management, unit inspection records, and monthly rent schedules.

### 2. Legal E-Signature & Agreement Engine
- **Statutory Compliance**: Formatted in strict accordance with the **Model Tenancy Act, 2021** and **Section 65B of the Indian Evidence Act**.
- **Integrated Digital Signing**:
  - Full-resolution dual-mode resident signature pads (Hand-drawn canvas strokes with anti-aliasing or formatted cursive typography).
  - Full-width **Witness 1 & Witness 2** attestation with address and digital signature capture.
  - Pre-authorized owner digital signature integration with cryptographic lock verification.
- **High-Definition PDF Generation**: Multi-page official tenancy agreements with schedule tables, terms, and legal execution stamps.

### 3. Check-Out & Deposit Settlement Workflow
- **Arithmetic Settlement Engine (Clause 3)**:
  - Transparent calculations for *Initial Deposit Held*, *Authorized Deductions*, and *Net Refund Payable*.
  - Inspection notes and deduction justifications.
  - Multi-mode transaction reference tracking (NEFT/IMPS, UPI, Cheque, Cash).
  - Mandatory physical key handover and vacant possession verification.
- **Real-Time Cross-Page Synchronization**: Instant live state updates across Property Views, Tenant Directories, and Agreement Registries powered by native `BroadcastChannel` and event messaging.

### 4. Financial Suite & Billing
- Automated monthly rent invoicing and utility charges.
- Payment tracking, receipt generation, and security deposit management.
- Expense categorisation, vendor payments, and real-time Profit & Loss (P&L) reporting.

### 5. Property Operations & Governance
- **Maintenance & Facilities**: Service request lifecycle, urgency prioritization, and resolution tracking.
- **Staff & Roster**: Facility staff management, shifts, and attendance.
- **Visitor Logs**: Secure check-in and check-out tracking for visitors.
- **Audit Trail & DPDP Compliance**: Complete chronological audit trail ensuring compliance with India's Digital Personal Data Protection (DPDP) Act.

---

## 🏗️ Architecture & Monorepo Structure

```
Multi-Property-Management-software/
├── apps/
│   ├── api/                   # NestJS Modular Monolith API (/api/v1)
│   │   ├── src/
│   │   │   ├── common/        # Interceptors, guards, filters, decorators
│   │   │   ├── config/        # Environment and service configurations
│   │   │   ├── database/      # Prisma client service
│   │   │   └── modules/       # Auth, properties, tenants, agreements, billing, etc.
│   │   └── test/              # End-to-end integration test suites
│   └── web/                   # Next.js 15 App Router Frontend
│       ├── public/            # Static brand assets and templates
│       └── src/
│           ├── app/           # Routes: dashboard, properties, tenants, agreements, etc.
│           ├── components/    # Reusable UI components, agreements, layout, modals
│           └── lib/           # Storage, state synchronization, date utilities, API client
├── packages/
│   ├── config/                # Shared application and infrastructure constants
│   ├── types/                 # Shared TypeScript interfaces, domain types, and enums
│   └── validation/            # Shared Zod validation schemas
├── prisma/
│   ├── schema.prisma          # PostgreSQL relational schema (30+ domain models)
│   └── migrations/            # Structured database migration history
├── ci/
│   └── ci.yml                 # Continuous Integration Pipeline specification
├── docs/                      # Architectural Decision Records (ADRs) and technical docs
├── .env.example               # Sanitized environment configuration template
├── .gitignore                 # Comprehensive security and secret exclusion rules
├── package.json               # Root monorepo workspace configuration
└── tsconfig.base.json         # Shared TypeScript compiler options
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/), Vanilla CSS / Tailwind tokens, [Lucide React](https://lucide.dev/) |
| **Backend** | [NestJS 10](https://nestjs.com/) (Modular Monolith), [Node.js](https://nodejs.org/) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) with [PostGIS](https://postgis.net/) |
| **ORM** | [Prisma 6](https://www.prisma.io/) |
| **Cache & Realtime** | [Redis 7](https://redis.io/), Web BroadcastChannel API |
| **Validation** | [Zod](https://zod.dev/) |
| **Security** | Argon2id, HTTP-only secure cookie sessions, RBAC + multi-tenant isolation |
| **Testing** | [Vitest](https://vitest.dev/), Jest, Supertest |

---

## ⚡ Quickstart & Local Setup

### 1. Prerequisites
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **PostgreSQL 16** with PostGIS extension & **Redis 7** (installed locally, in WSL2, or via Docker)

### 2. Clone the Repository
```bash
git clone https://github.com/HariharanM-AI/Multi-Property-Management-software.git
cd Multi-Property-Management-software
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Copy the sanitized environment template to create local configuration files:
```bash
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```
> ⚠️ **Security Warning**: Never commit `.env` or sensitive credentials to version control. All secret patterns are ignored by `.gitignore`.

### 5. Database Setup & Prisma Generation
```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations
npx prisma migrate dev

# Build shared packages
npm run build:packages
```

### 6. Run Development Servers
```bash
# Start the NestJS Backend API (runs on http://localhost:4000/api/v1)
npm run dev:api

# Start the Next.js Frontend Web Application (runs on http://localhost:3000)
npm run dev:web
```

---

## 🧪 Quality Assurance & Testing

```bash
# Run unit & component test suites
npm run test

# Perform TypeScript static typechecking across all workspaces
npm run typecheck

# Run ESLint across monorepo
npm run lint

# Validate Prisma relational schema
npx prisma validate

# Build production bundles
npm run build
```

---

## 🔒 Security & Data Protection (DPDP Act)

- **Argon2id Hashing**: Industry-standard cryptographic key derivation for user credentials.
- **Four-Tier Authorization Chain**: Strict evaluation pipeline: *Authentication → Organization Tenancy → RBAC Roles → Resource Scoping*.
- **Zero Secrets in Client**: All API keys, database credentials, and signing secrets remain strictly on the backend.
- **Indian DPDP Act Compliance**: Data retention limits, consent logging, and complete tenant record auditability.

---

## 📄 License & Ownership

Copyright © 2026 **Hariharan M**. All rights reserved.  
Proprietary software for enterprise property management operations.
