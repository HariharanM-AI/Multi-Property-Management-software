# ADR-002: PostgreSQL & Prisma ORM for Core Transactional Data

## Status
Accepted

## Context
Property management involves deeply relational, highly structured data with ACID transactional guarantees (leases, invoices, ledger entries, security deposit settlements, bed allocation state). NoSQL databases lack relational integrity and foreign key constraints necessary for financial auditability.

## Decision
- Use **PostgreSQL 16** with **PostGIS** as the primary transactional database.
- Use **Prisma ORM 6** for type-safe schema modeling, migrations, parameterized queries, and transactional safety.
- Explicitly forbid raw string-concatenated SQL queries.

## Consequences
### Positive
- Strict schema enforcement, foreign key constraints, and relational integrity.
- Full ACID transactions for financial operations.
- Spatial indexing for property discovery and geo-coordinates via PostGIS.
- Type-safe query generation generated directly into TypeScript models.

### Negative
- Schema changes require structured migrations.
