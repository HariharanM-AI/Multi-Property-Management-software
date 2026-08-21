# ADR-001: Adoption of Modular Monolith Architecture

## Status
Accepted

## Context
PropertyOS is a multi-tenant property management platform covering complex domains (PG, Whole-Unit Rental, Billing, Maintenance, Inventory, KYC, Check-In/Out). Building microservices in Phase 1 would introduce high operational overhead, distributed transaction complexities (e.g. 2PC/sagas for payments and check-in), network latency, and infrastructure costs.

## Decision
Adopt a **Modular Monolith** architecture within a single TypeScript monorepo:
- `apps/api`: NestJS backend structured by domain modules (`auth`, `organizations`, `properties`, `tenants`, `billing`, `maintenance`, `electricity`, etc.).
- `apps/web`: Next.js frontend with App Router.
- `packages/`: Shared typing, validation schemas, and configuration.

## Consequences
### Positive
- Single database transaction boundary for complex business workflows (e.g. Check-in + Bed Allocation + Invoice Creation + Deposit Ledger).
- Zero network hops between domain services.
- Simple local development and deployment via single container images.
- Clear module boundaries allow decomposing specific modules (e.g., notification dispatch, analytics) into independent services later if required.

### Negative
- Requires strict internal boundary enforcement to prevent tight coupling across domain modules.
