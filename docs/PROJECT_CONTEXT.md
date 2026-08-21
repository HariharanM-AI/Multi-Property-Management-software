# PropertyOS — Project Context & Architectural Foundation

## 1. Product Overview
**PropertyOS** is an enterprise-grade, multi-tenant Property Management Platform specifically engineered for the Indian rental and residential operations market. It unifies operations across two distinct operating models under a single owner organization:

1. **PG / Co-Living / Hostel Properties**: Room- and bed-level inventory, per-bed allocation, room sharing, meal/mess management, sub-metered electricity bill splitting, daily attendance, visitor gatepasses.
2. **Whole-Unit Rental Properties**: Flat/villa/house-level inventory, tenant/household leases, security deposits with deductions/refund records, lease renewals, rent escalations, notice periods.

---

## 2. Phase 1 Scope & Boundary Conditions
- **Zero AI / ML / LLM / Vector Search**: Phase 1 contains strictly deterministic, relational, and business-rule-driven operations. No AI libraries, vector databases, or predictive models are active.
- **Relational Integrity**: PostgreSQL with PostGIS is the sole transactional source of truth.
- **Modular Monolith**: A single clean monorepo containing `apps/api` (NestJS) and `apps/web` (Next.js App Router) with shared type and validation packages (`packages/types`, `packages/validation`, `packages/config`).
- **No Mock Replacements**: All operational features connect to real database models, transactions, validation pipelines, and audit logs.

---

## 3. Core Domain Hierarchy & Multi-Tenancy
Multi-tenancy is enforced at the organization level:
```
Organization
 └── Users & Roles (Owner, Property Manager, Accountant, Warden, Security, Maintenance, Tenant)
      └── Properties (Type: PG | RENTAL_HOUSE)
           ├── [PG Path] Floors → Rooms → Beds → Bed Stays
           └── [Rental Path] Rental Units → Leases
                └── Tenants (Profile, KYC, Documents, Agreements, Invoices, Payments, Tickets)
```

### Mandatory 5-Step Authorization Pipeline
Every resource operation across the platform must pass the strict 5-step validation pipeline:
1. **Authenticated User**: Identity verified via secure HTTP-only cookie session (SHA-256 token hash).
2. **Organization Membership**: Verified that the authenticated user belongs to an active, valid organization (`TenantOrgGuard`).
3. **Required Permission**: Evaluated via `PermissionsGuard` against the machine-readable `ROLE_PERMISSIONS_MAP`.
4. **Resource Ownership Verification**: Resource's `organizationId` strictly matches the user's authenticated `organizationId`.
5. **Operation Allowed**: Execution inside a row-level scoped Prisma database transaction.

> Note: Future permissions (`property.*`, `tenant.*`, `billing.*`, `maintenance.*`) are authorization foundations only and do not grant access to nonexistent or unapproved business endpoints.

---

## 4. Design Language & Aesthetics
The UI adheres strictly to the 3-color brand rule with WCAG AA compliance:
- **Primary Surface / Background**: `#FFFFFF` (with `#F8FAFC` light neutral surface)
- **Accent 1 (Primary Navigation / Dark Surface / Text)**: `#0F172A` (Deep Slate Navy)
- **Accent 2 (Action / Positive Highlight / Accents)**: `#0F766E` (Deep Emerald Teal)
- **Neutral UI Tokens**: `#E2E8F0` (Borders), `#64748B` (Secondary text), `#94A3B8` (Disabled / Muted)

---

## 5. Technology Stack Summary
- **Backend**: NestJS (TypeScript, Modular Monolith, Helmet, CORS whitelist, Rate limiting, Argon2id, Zod/ValidationPipe).
- **Frontend**: Next.js 14+ (App Router, React 19, TypeScript strict, Tailwind CSS, Lucide React, TanStack Query).
- **Database & ORM**: PostgreSQL 16 (PostGIS), Prisma ORM 6.
- **Cache & Jobs**: Redis 7, BullMQ.
- **Testing**: Vitest, Jest, Supertest.
- **Deployment & Infra**: Docker Compose (Local development), Google Cloud Run & Cloud Storage ready (GCP).
