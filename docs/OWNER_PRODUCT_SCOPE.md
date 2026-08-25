# PropertyOS — Owner-Only Product Scope & Audit Classification

## 1. Product Mission & Boundaries
PropertyOS is strictly an **Enterprise Property Owner & Property Operator Management Platform**.
- **Target Personas**: Property Owners, Portfolio Operators, Property Managers, Operations Staff, Accountants.
- **Strict Boundary**: Phase 1 contains **zero tenant-facing portals, zero tenant self-service screens, and zero consumer discovery**.
- **Internal Occupant Management**: Occupant, lease, KYC, and financial records remain fully accessible to the owner for business operations and accounting.
- **Phase 2 Tenant Product**: All resident-facing workflows (community feed, second-hand marketplace, public discovery, tenant self-payment) are architecturally separated and archived in `docs/future-tenant-product/`.

---

## 2. Comprehensive Repository Audit & Classification Matrix

### Category A — Owner Core
*Core business capabilities, portfolio hierarchy, identity, financial ledger, and executive analytics.*

| Item / Module | Layer | Purpose | Status in Owner App |
| :--- | :--- | :--- | :--- |
| `AuthModule` / `/login`, `/register` | Full-stack | Owner & staff authentication, Argon2id passwords, HTTP-only secure cookie sessions | **RETAIN (CORE)** |
| `OrganizationsModule` / `/settings/organization` | Full-stack | Multi-tenant organization scoping, settings, address, tax details | **RETAIN (CORE)** |
| `TeamModule` / `/settings/team` | Full-stack | Staff invitation, role assignment, and team directory | **RETAIN (CORE)** |
| `PropertiesModule` / `/properties` | Full-stack | Multi-property portfolio management, PG & Rental dual operating models, amenities, media | **RETAIN (CORE)** |
| `PgStructureModule` / `/properties/[id]/floors`, `/pg/rooms` | Full-stack | PG hierarchy: floors, rooms, sharing capacities, bed inventories | **RETAIN (CORE)** |
| `RentalModule` / `/properties/[id]/units`, `/properties/[id]/leases` | Full-stack | Whole-unit rental flats/villas, lease terms, rent escalations | **RETAIN (CORE)** |
| `BillingModule` & `InvoicesModule` / `/billing`, `/invoices` | Full-stack | Automated recurring billing cycles, itemized invoices, line items, DRAFT $\rightarrow$ ISSUED $\rightarrow$ PAID | **RETAIN (CORE)** |
| `PaymentsModule` & `LedgerModule` / `/payments`, `/ledger` | Full-stack | Payment recording, invoice allocation, double-entry balanced ledger ($DR \equiv CR$) | **RETAIN (CORE)** |
| `ExpensesModule` / `/expenses` | Full-stack | Categorized property operational expenses, receipts, vendor spend, Decimal INR math | **RETAIN (CORE)** |
| `ReportsModule` / `/reports` | Full-stack | Financial analytics: Cash & Accrual NOI, margin %, property comparisons, sanitized CSV export | **RETAIN (CORE)** |
| `DashboardModule` / `/` | Full-stack | Executive Portfolio Command Center with real-time health metrics and Owner Attention Engine | **RETAIN (CORE)** |

---

### Category B — Owner Operational Support
*Facility management, staff attendance, security, inventory, and utility operations.*

| Item / Module | Layer | Purpose | Status in Owner App |
| :--- | :--- | :--- | :--- |
| `MaintenanceModule` / `/maintenance` | Full-stack | Work order dispatching, Kanban board, technician assignment, repair cost tracking | **RETAIN (OPERATIONS)** |
| `StaffModule` / `/staff` | Full-stack | Staff directory, daily check-in/out attendance, safe deactivation, monthly payroll KPIs | **RETAIN (OPERATIONS)** |
| `VisitorsModule` / `/visitors` | Full-stack | Security desk guard console, visitor gatepass lookup (`GP-`), entry/exit logging | **RETAIN (OPERATIONS)** |
| `InventoryModule` / `/inventory` | Full-stack | Operational asset tracking, condition grading (`NEW` to `DAMAGED`), room/unit allocations | **RETAIN (OPERATIONS)** |
| `ElectricityModule` / `/electricity` | Full-stack | Sub-metered readings, tariff rates, remainder allocation, meter reset overrides | **RETAIN (OPERATIONS)** |
| `MealsModule` / `/meals` | Full-stack | PG mess plans, subscriptions, daily attendance matrix, auto-invoicing | **RETAIN (OPERATIONS)** |
| `ServicesModule` / `/services` | Full-stack | Internal facility service desk, staff technician dispatching, vendor work orders | **REFACTOR (OWNER-DESK ONLY)** |

---

### Category C — Owner + Internal Occupant Management
*Occupant records, KYC compliance, onboarding allocations, and legal agreements managed by the owner.*

| Item / Module | Layer | Purpose | Status in Owner App |
| :--- | :--- | :--- | :--- |
| `TenantsModule` / `/tenants`, `/tenants/[id]` | Full-stack | Occupant directory, contact details, stay history, verified KYC document repository | **RETAIN (OCCUPANT RECORDS)** |
| `CheckinsModule` / `/check-ins` | Full-stack | Owner-managed digital check-in, bed/unit allocation, deposit collection verification | **RETAIN (OPERATIONS)** |
| `CheckoutsModule` / `/check-outs` | Full-stack | Owner-managed move-out inspection, damage deductions, deposit refund settlement | **RETAIN (OPERATIONS)** |
| `AgreementsModule` / `/agreements` | Full-stack | Agreement template authoring, variable interpolation, SHA-256 snapshots, renewal tracking | **RETAIN (COMPLIANCE)** |
| `SecurityDepositsModule` | Backend | Deposit ledger tracking, deduction history, refund reconciliation | **RETAIN (FINANCE)** |

---

### Category D — Tenant Product (Archived for Phase 2)
*Resident-facing self-service, peer-to-peer commerce, and discussion boards separated from owner software.*

| Item / Module | Layer | Purpose | Action in Owner App |
| :--- | :--- | :--- | :--- |
| `CommunityModule` / `/community` | Full-stack | Resident discussion board, tenant comment threads, community posts | **ARCHIVED FOR PHASE 2** (Removed from Owner UI/Nav) |
| `MarketplaceModule` / `/marketplace` | Full-stack | Tenant peer-to-peer second-hand goods marketplace | **ARCHIVED FOR PHASE 2** (Removed from Owner UI/Nav) |
| Tenant Self-Service Service Requests | Frontend/API | Tenant-facing service request creation and tracking | **ARCHIVED FOR PHASE 2** (Owner-managed service desk preserved) |
| Tenant Self-Service Payments | Concept | Tenant-facing payment submission and wallet screens | **ARCHIVED FOR PHASE 2** (Owner payment recording preserved) |

---

### Category E — Public / Prospective User Product (Archived for Phase 2)
*Consumer-facing property discovery engine.*

| Item / Module | Layer | Purpose | Action in Owner App |
| :--- | :--- | :--- | :--- |
| `DiscoveryModule` / `/discover`, `/discover/[id]` | Full-stack | Public consumer discovery portal with Haversine distance search | **ARCHIVED FOR PHASE 2** (Removed from Owner UI/Nav) |

---

### Category F — Shared Infrastructure
*Reusable architectural infrastructure supporting owner operations and future extensions.*

| Item / Module | Layer | Purpose | Status in Owner App |
| :--- | :--- | :--- | :--- |
| `NotificationsModule` / `/notifications` | Full-stack | Owner alerting engine (overdue rent, lease renewals, SLA breaches, staff alerts) | **RETAIN (OWNER NOTIFICATIONS)** |
| `AuditModule` / `/audit` | Full-stack | Append-only compliance audit trail, sensitive data redaction, CSV/JSON export | **RETAIN (COMPLIANCE)** |
| `JobsModule` / `/jobs` | Full-stack | BullMQ queue processor, 6 deterministic background workers, DLQ, cron editor | **RETAIN (AUTOMATION)** |
| `StorageService` / `LocalStorageDriver` | Backend | UUID file storage abstraction, MIME validation, physical file unlinking | **RETAIN (INFRASTRUCTURE)** |
| `PrismaModule` & Database Services | Database | PostgreSQL 16 connection pooling, migrations, advisory locking | **RETAIN (DATABASE)** |
| `HealthModule` / `/api/v1/health` | Backend | Diagnostic health and uptime check for database and Redis | **RETAIN (OBSERVABILITY)** |

---

### Category G — Ambiguous / Architectural Decisions
1. **Notice Board vs Tenant Forum:**
   - *Decision:* Tenant-to-tenant forum is removed. Owner-to-property broadcast capability is consolidated under Property Announcements.
2. **Local Services Desk:**
   - *Decision:* Owner/Facility work order dispatching is retained under Operations (`/services`). Tenant self-booking UI is archived for Phase 2.

---

### Category H — Obsolete / Duplicate
- Redundant prototype navigation links.
- Public discovery navigation references from Owner Header and Sidebar.
