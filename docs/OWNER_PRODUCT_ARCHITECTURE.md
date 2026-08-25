# PropertyOS — Owner Operations Platform Architecture

## 1. Executive Architecture Summary
PropertyOS is engineered as an **Owner-Only Property Management System** for landlords, real estate portfolio operators, and property management enterprises managing PG/hostel and whole-unit rental properties in India.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PROPERTYOS OWNER PLATFORM (PHASE 1)                  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Executive Command Center & Owner Attention Engine                   │
│ 2. Dual-Model Portfolio Management (PG/Co-Living + Whole-Unit Rental)  │
│ 3. Internal Occupant & Compliance Administration (KYC, Stays, Leases)  │
│ 4. Double-Entry Accounting, Invoicing, Billing Schedules & Ledger      │
│ 5. Facility Operations: Maintenance Kanban, Staff, Visitors, Inventory │
│ 6. Shared Infrastructure: BullMQ 5.41, Redis 7, Immutable Audit Logs  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Future Phase 2 Boundary
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               PROPERTYOS TENANT / RESIDENT APP (PHASE 2)               │
│ (Resident Self-Service, Community Board, Marketplace, Public Search)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Information Architecture & Navigation Hierarchy

The Owner Operations interface is organized into **10 streamlined operational functional groups**:

1. **Dashboard (`/`)**: Portfolio Health, Owner Attention Engine, Cash Flow, and Real-Time Activity.
2. **Properties (`/properties`)**: Portfolio roster, PG room/bed hierarchies (`/pg/rooms`), and rental units.
3. **Occupants (`/tenants`)**: Occupant directory, KYC verification, Digital Check-ins (`/check-ins`), Check-outs (`/check-outs`), and Agreements (`/agreements`).
4. **Finance (`/billing`)**: Billing schedules, Invoices (`/invoices`), Payments (`/payments`), Expenses (`/expenses`), and General Ledger (`/financials`).
5. **Maintenance (`/maintenance`)**: SLA-driven work orders, vendor assignments, and repair costs.
6. **Operations (`/staff`)**: Staff directory & attendance, Visitor Gatepass Desk (`/visitors`), Room Inventory (`/inventory`), Electricity Utilities (`/electricity`), and PG Meals (`/meals`).
7. **Services Desk (`/services`)**: Facility work order dispatching and service provider management.
8. **Compliance & Audit (`/audit`)**: Append-only compliance log, sensitive data redaction, and compliance export.
9. **Automation (`/jobs`)**: BullMQ queue monitor, DLQ diagnostics, and recurring cron scheduler.
10. **Reports (`/reports`)**: Portfolio P&L statement, occupancy rates, and cross-property comparisons.

---

## 3. Product Differentiation: "Time Saved for the Owner"

PropertyOS differentiates from generic CRUD tools through **Automated Owner Operations**:
- **Automatic Invoice Generation**: Midnight BullMQ jobs generate rent, electricity, and meal charges without manual data entry.
- **Proactive Overdue Escalation**: Receivables aging detection and automated collection alerts.
- **Lease Expiry Pipeline**: Automated 90/60/30/15-day renewal task triggers.
- **SLA-Driven Maintenance**: Automated breach escalation for urgent work orders.
- **Owner Attention Engine**: Ranked deterministic alerts prioritizing critical operational exceptions.
