# Future Tenant Product — System Architecture

## Architectural Model
The Phase 2 Tenant Product is designed as a lightweight, mobile-first web or mobile application (Next.js PWA / React Native) communicating with dedicated, least-privilege Tenant APIs.

```
┌────────────────────────────────────────────────────────┐
│         PROPERTYOS TENANT CLIENT (PHASE 2)             │
│        (Mobile Web / iOS / Android Application)        │
└──────────────────────────┬─────────────────────────────┘
                           │ Authenticated via Tenant JWT / Session
                           ▼
┌────────────────────────────────────────────────────────┐
│            PROPERTYOS TENANT API GATEWAY               │
│           (Scoped to Active Tenant Stay)               │
├────────────────────────────────────────────────────────┤
│ • Tenant Profile & Documents    • Invoices & Payments  │
│ • Maintenance Request Tickets   • Visitor Pre-Reg      │
│ • Community Notice Feed         • P2P Marketplace      │
└──────────────────────────┬─────────────────────────────┘
                           │ Reads/Writes Scoped Entities
                           ▼
┌────────────────────────────────────────────────────────┐
│             CORE DATABASE & BACKGROUND JOBS            │
│       (PostgreSQL 16, PostGIS, Redis 7, BullMQ)        │
└────────────────────────────────────────────────────────┘
```

## Isolation Principles
1. **Zero Owner Scope Access**: Tenants have zero visibility into other tenants' financial records, whole-building P&L reports, or owner settings.
2. **Active Stay Scoping**: Every tenant API call requires an active stay verification (`TenantStayHistory.status = ACTIVE`).
3. **Property Context Isolation**: Community and marketplace feeds are strictly isolated to the property where the tenant resides.
