# PropertyOS — Feature Dependencies Graph

This document defines the strict DAG (Directed Acyclic Graph) of module dependencies. Features must be implemented strictly following these dependency tiers.

```mermaid
graph TD
    CORE001[CORE-001: Foundation & Monorepo] --> CORE002[CORE-002: Auth & Session Management]
    CORE001 --> CORE030[CORE-030: Security & Compliance]
    
    CORE002 --> CORE003[CORE-003: Organizations & RBAC]
    CORE003 --> CORE004[CORE-004: Property Management]
    
    CORE004 --> CORE005[CORE-005: PG Structure Floors/Rooms/Beds]
    CORE004 --> CORE006[CORE-006: Rental Structure Units/Leases]
    
    CORE003 --> CORE007[CORE-007: Tenant Management & KYC]
    CORE005 --> CORE008[CORE-008: Digital Check-In]
    CORE006 --> CORE008
    CORE007 --> CORE008
    
    CORE008 --> CORE010[CORE-010: Agreements & Templates]
    CORE008 --> CORE011[CORE-011: Billing & Double-Entry Ledger]
    CORE011 --> CORE012[CORE-012: Electricity & PG Meal Management]
    CORE005 --> CORE012
    
    CORE004 --> CORE013[CORE-013: Maintenance & Work Orders Foundation]
    CORE005 --> CORE013
    CORE006 --> CORE013
    CORE007 --> CORE013
    
    CORE003 --> CORE017[CORE-017: Staff & Attendance]
    CORE004 --> CORE018[CORE-018: Visitor Management]
    CORE004 --> CORE019[CORE-019: Inventory Tracking]
    CORE004 --> CORE020[CORE-020: Expense Management]
    
    CORE011 --> CORE021[CORE-021: Profit & Loss Reports]
    CORE020 --> CORE021
    
    CORE021 --> CORE022[CORE-022: Multi-Property Dashboard]
    CORE008 --> CORE009[CORE-009: Digital Check-Out & Settlement]
    CORE011 --> CORE009
    
    CORE002 --> CORE023[CORE-023: In-App Notifications]
    CORE004 --> CORE024[CORE-024: Property Discovery & PostGIS]
    CORE007 --> CORE025[CORE-025: Tenant Community]
    CORE007 --> CORE026[CORE-026: Tenant Marketplace]
    CORE004 --> CORE027[CORE-027: Local Service Requests]
    
    CORE001 --> CORE028[CORE-028: Audit Trail & Event Logging]
    CORE001 --> CORE029[CORE-029: BullMQ Job Scheduler]
```

## Dependency Tiers Summary
1. **Tier 0 (Foundation)**: CORE-001 (Monorepo, Config, Docker, Prisma, Packages), CORE-030 (Security Baseline), CORE-028 (Audit Log Foundation), CORE-029 (Queue Foundation).
2. **Tier 1 (Identity & Multi-Tenancy)**: CORE-002 (Auth), CORE-003 (Orgs & RBAC).
3. **Tier 2 (Core Physical Models)**: CORE-004 (Properties), CORE-005 (PG Hierarchy), CORE-006 (Rental Hierarchy).
4. **Tier 3 (Tenant & Lifecycle)**: CORE-007 (Tenants & KYC), CORE-008 (Check-In), CORE-010 (Agreements), CORE-009 (Check-Out & Settlement).
5. **Tier 4 (Financial & Utilities)**: CORE-011 (Billing & Ledger Foundation), CORE-012 (Electricity & PG Meal Management), CORE-014 (Sub-Metered Electricity Billing & Concurrency Hardening).
6. **Tier 5 (Operations & Facility)**: CORE-013 (Maintenance & Work Order Foundation), CORE-017 (Staff/Attendance), CORE-018 (Visitors), CORE-019 (Inventory), CORE-020 (Expenses).
7. **Tier 6 (Analytics & Dashboards)**: CORE-021 (P&L), CORE-022 (Executive Dashboards).
8. **Tier 7 (Engagement & Ecosystem)**: CORE-023 (Notifications), CORE-024 (Discovery), CORE-025 (Community), CORE-026 (Marketplace), CORE-027 (Services).
