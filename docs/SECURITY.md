# PropertyOS — Enterprise Security Specification

## 1. Security Architecture & Principles
PropertyOS is built on a Zero-Trust, Deterministic foundation with strict multi-tenant resource isolation.

---

## 2. Multi-Tenant Resource Isolation & Authorization Pipeline

### Future Permission Foundation Boundary
All defined permissions such as `property.*`, `tenant.*`, `billing.*`, and `maintenance.*` serve strictly as **authorization foundations** in Phase 1. They define granular capabilities in the machine-readable RBAC matrix ahead of time, but:
1. They do **not** grant access to nonexistent or unapproved endpoints.
2. They do **not** bypass tenant isolation boundaries.
3. Every operation must satisfy both **RBAC Permission** AND **Resource Ownership**.

### Mandatory 5-Step Authorization Pipeline:
Every resource operation across the platform (and specifically in CORE-004 Property Management) must execute through the following chain:
```
1. Authenticated User
   ↓
2. Organization Membership (Verified via Session/TenantOrgGuard)
   ↓
3. Required Permission (Evaluated via PermissionsGuard against ROLE_PERMISSIONS_MAP)
   ↓
4. Resource Ownership Verification (Resource organizationId === Authenticated organizationId)
   ↓
5. Operation Allowed (Prisma row-level scoped transaction)
```

If a user possesses a permission (e.g. `property.read`) but requests a property belonging to another organization, the request is immediately rejected with `403 Forbidden` / `404 Not Found` without leaking whether the resource exists.

---

## 3. Deterministic RBAC Permission Matrix

| Permission String | Capability Description | OWNER | PROPERTY_MANAGER | ACCOUNTANT | WARDEN | SECURITY | MAINTENANCE_STAFF |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `organization.read` | View Organization Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `organization.update` | Update Legal Name / GSTIN | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `team.read` | View Team Roster | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `team.invite` | Invite Team Members | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `team.update` | Change Role / Deactivate | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `team.remove` | Remove Member from Org | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `property.read` | View Properties & Units | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `property.create` | Create New Properties | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `property.update` | Update Property Info / Media | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `property.delete` | Authorize Property Archive/Restore (Soft Delete) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `tenant.read` | View Tenants & Leases | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `tenant.create` | Onboard Tenant | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `tenant.update` | Update Tenant Profile | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `tenant.delete` | Terminate / Evict Tenant | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `billing.read` | View Invoices & Payments | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `billing.create` | Generate Invoices | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `billing.update` | Record Payments | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `maintenance.read` | View Maintenance Tickets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `maintenance.create` | Create Ticket / Request | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `maintenance.update` | Update Ticket & Schedule | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `maintenance.assign` | Assign Staff to Ticket | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `maintenance.comment` | Add Comments / Discussion | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `maintenance.complete` | Mark Work Completed | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `maintenance.verify` | Verify Completed Work | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `maintenance.close` | Close Verified Ticket | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `maintenance.cancel` | Cancel Maintenance Ticket | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `maintenance.manage_cost` | Manage Estimates & Actual Costs | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `maintenance.manage_vendor` | Manage Vendors | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `reports.read` | View Reports | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 4. Property Delete / Archive Semantics
1. **Soft-Delete / Archive Rule**:
   - In Phase 1, the `property.delete` permission strictly authorizes the property's **soft-deletion/archive** operation (`POST /properties/:id/archive`).
   - There is **no physical deletion** of properties from PostgreSQL through the normal property API.
   - Authorized owners can reverse archiving at any time via `POST /properties/:id/restore`.
   - Archived properties are excluded by default from active listings (`WHERE deletedAt IS NULL`).

---

## 5. Concurrency-Safe Sequence & Code Generation
- Property reference codes (`PROP-000001`, `PROP-000002`) are generated atomically in PostgreSQL via interactive `$transaction` on `OrganizationSequence`.
- Database uniqueness constraint: `@@unique([organizationId, code])`.
- Zero race conditions under simultaneous concurrent property creation requests.

---

## 6. Property Media & File Upload Security
- Strict storage abstraction via `StorageService` isolating the domain from filesystem APIs.
- UUID-based filenames to defend against directory traversal and collision attacks.
- Server-side MIME validation against verified binary signatures (JPEG, PNG, WEBP, PDF).
- Maximum file size limits: 5 MB for images, 25 MB for documents.
- Executable files (`.exe`, `.sh`, `.js`, `.bat`) are rejected immediately.

---

## 7. PG Structure Inventory Security & Safeguards (CORE-005)

### 7.1 Scope & Capability Enforcement
- PG inventory operations (Floors, Rooms, Beds) strictly enforce that the target property is of type `PG`.
- Invoking these endpoints on a property with `propertyType === RENTAL_HOUSE` is rejected with `400 Bad Request`.

### 7.2 Soft-Delete Safeguards & Referential Integrity
- Floor, Room, and Bed deletions use soft-delete trackers (`deletedAt IS NOT NULL`) to preserve historical stay records.
- Deletions are strictly prevented at the database service level under the following conditions:
  - Deleting an occupied Bed (`status === OCCUPIED`) throws `400 Bad Request`.
  - Deleting a Room containing any occupied beds throws `400 Bad Request`.
  - Deleting a Floor containing any rooms with occupied beds throws `400 Bad Request`.

### 7.3 Bed Status Transition Controls
- State transitions are validated by the backend service to prevent data corruption.
- Directly setting an `OCCUPIED` bed to `MAINTENANCE` or `BLOCKED` without an explicit checkout is rejected with `400 Bad Request`.

---

## 8. Billing, Invoicing & Double-Entry Ledger Integrity (CORE-011)
- **Zero Rounding Leakage**: All monetary values use 12,2 Decimal precision.
- **Balanced Double-Entry Constraint**: Every issued invoice, payment allocation, and deposit forfeiture generates balanced double-entry ledger entries where `Total Debit === Total Credit`.
- **Append-Only Immutability**: Ledger entries cannot be modified or physically deleted. Corrections require offsetting reversing entries.
- **Idempotent Billing Runs**: Due billing cycle generators run idempotently using deterministic date windows and existing schedule tracking.
- **Over-Allocation Prevention**: Payment allocation cannot exceed either the unallocated payment balance or the invoice outstanding balance.

---

## 9. Electricity & PG Mess Isolation and Deterministic Allocation (CORE-012)
- **Zero-AI Deterministic Execution**: All calculations are strictly rule-based arithmetic.
- **Property Type Isolation**: Electricity room-sharing and PG mess plans/attendance fail closed (`404 Not Found`) when invoked against `RENTAL_HOUSE` properties.
- **Deterministic Remainder Allocation**: When dividing utility costs across multiple tenants, base amounts are truncated to 2 decimal places and the remainder cents are deterministically distributed such that `sum(tenant allocations) === total reading charge` exactly.
- **Meter Reading Tamper Prevention**: Decreasing meter readings (`current < previous`) are rejected with `400 Bad Request` unless authorized with `isResetOverride = true` and a mandatory non-empty `resetReason`.
- **Unique Attendance Constraint**: Daily tenant mess attendance enforces unique constraint `@@unique([tenantId, mealDate, mealType])` with single-click idempotent updates.

---

## 10. Sub-Metered Electricity Billing Hardening & Concurrency Safeguards (CORE-014)
- **Transactional Atomic Invoicing**: `ElectricityService.generateCharges` executes reading charge creation, invoice creation, line items, and double-entry ledger entries in a single PostgreSQL transaction client (`tx`). Any failure rolls back 100% of mutations, preventing orphaned charges or unbalanced ledgers.
- **Charge Generation Advisory Locking**: Uses `SELECT pg_advisory_xact_lock(hashtext('electricity_charge_' || readingId))` to serialize concurrent charge generation calls, returning idempotent charge sets on race conditions.
- **Active Rate Overlap Prevention**: Rates per property are validated against overlapping date ranges and serialized using `SELECT pg_advisory_xact_lock(hashtext('electricity_rate_' || propertyId))`.
- **Meter Reset Authorization Matrix**: Meter resets (`isResetOverride: true`) require explicit `Permission.ELECTRICITY_UPDATE`. Roles lacking this permission receive `403 Forbidden`.
- **Error Normalization**: Expected Prisma P2002 uniqueness conflicts are trapped and normalized to `409 Conflict` (HTTP Conflict) rather than generic internal server errors.

---

---

## 12. Maintenance Concurrency, Advisory Locking & Financial Cost Protections (CORE-016)
- **Ticket Sequence Generation Advisory Locking**: Uses `SELECT pg_advisory_xact_lock(hashtext('ticket_seq_' || organizationId))` to serialize parallel ticket number generation per organization, preventing duplicate ticket numbers or race condition gaps.
- **State Machine Transition Advisory Locking**: Uses `SELECT pg_advisory_xact_lock(hashtext('ticket_transition_' || ticketId))` to serialize competing state transitions (`OPEN → ASSIGNED → IN_PROGRESS → COMPLETED → VERIFIED → CLOSED`). Out-of-order or invalid status jumps are rejected with `409 Conflict`.
- **Vendor Deduplication Advisory Locking**: Uses `SELECT pg_advisory_xact_lock(hashtext('vendor_' || organizationId || '_' || lower(normalizedVendorName)))` to serialize concurrent vendor registrations within the organization. Duplicate vendor names return a clean `409 Conflict`.
- **Operating Model Target Validation**: Enforces strict property capability rules at runtime: `PG` properties reject whole-unit rental targets (`rentalUnitId`), while `RENTAL_HOUSE` properties reject room/bed targets (`roomId`, `bedId`, `floorId`) with `400 Bad Request`.
- **Role-Based Financial Cost Sanitization**: Internal maintenance costs (`estimatedCost`, `actualCost`) are masked and returned as `null` when accessed by tenant users. Modification of cost fields by tenant accounts is rejected with `403 Forbidden`. Non-negative Decimal validation prevents negative cost entries.
- **Immutable Terminal State Safeguards**: Once a ticket reaches `CLOSED`, it cannot be transitioned to `IN_PROGRESS`, `COMPLETED`, `VERIFIED`, or `CANCELLED` (`409 Conflict`).
- **Multi-Tenant Fail-Closed Isolation**: All maintenance ticket, comment, attachment, and vendor endpoints enforce organization-level scoping and return `404 Not Found` without disclosing resource existence if accessed by an unauthorized organization.

---

## 13. Staff & Attendance Management Security & Concurrency Safeguards (CORE-017)
- **Staff Registration Advisory Locking**: Uses `SELECT pg_advisory_xact_lock(hashtext('staff_create_' || organizationId || '_' || normalizedPhone))` to serialize concurrent staff registrations on duplicate phone numbers. Prevents concurrent duplicate active staff creation with clean `409 Conflict`.
- **Attendance Logging Advisory Locking**: Uses `SELECT pg_advisory_xact_lock(hashtext('staff_att_' || staffMemberId || '_' || YYYY-MM-DD))` to serialize concurrent check-in and attendance recording per staff member per calendar date. Competing check-in calls return clean `409 Conflict`.
- **Safe Deactivation Pattern**: Staff deletion via `DELETE /api/v1/staff/:id` performs safe deactivation (`isActive = false`). It preserves the staff profile, complete historical attendance logs, and audit trail without physical database deletion.
- **Non-Negative Decimal Salary Validation**: Staff salaries must be non-negative (`salaryMonthly >= 0` Decimal(10,2)). Zero monthly salary is valid (volunteers/interns), while negative numbers are strictly rejected with `400 Bad Request`.
- **Multi-Tenant Fail-Closed Scoping**: Linking User accounts or assigning Properties from foreign organizations fails closed with `404 Not Found`. Cross-organization staff access is strictly blocked (`404 Not Found`).
- **RBAC & Security Boundaries**: Full staff management (`staff.create`, `staff.update`, `staff.delete`) is restricted to Owner and Property Manager roles. Accountants have read-only access (`staff.read`, `attendance.read`). Wardens and Security have attendance logging access (`attendance.record`). Tenant accounts are strictly forbidden from all staff and attendance endpoints (`403 Forbidden`).
- **Zero Sensitive Data Leaks in Audit Logs**: Passwords, auth tokens, and session secrets are never captured in audit log metadata. All staff events (`STAFF_CREATED`, `STAFF_UPDATED`, `STAFF_DELETED`, `STAFF_CHECKED_IN`, `STAFF_CHECKED_OUT`, `STAFF_ATTENDANCE_RECORDED`) are logged with sanitized metadata.

---

## 14. Visitor & Gatepass Management Security & Concurrency Safeguards (CORE-018)
- **Gatepass Code Generation Advisory Locking**: Uses `SELECT pg_advisory_xact_lock(hashtext('visitor_gp_' || gatePassCode))` with collision-safe generation (`GP-YYYYMMDD-XXXX`) to ensure absolute gatepass code uniqueness across concurrent registrations.
- **Physical Entry & Exit Advisory Locking**: Check-in and check-out workflows acquire transaction-scoped locks (`SELECT pg_advisory_xact_lock(hashtext('visitor_checkin_' || id))` and `SELECT pg_advisory_xact_lock(hashtext('visitor_checkout_' || id))`). Under parallel concurrent checkout requests (e.g. 5 simultaneous calls), exactly 1 succeeds and 4 return clean `409 Conflict`, with exactly 1 audit log created.
- **Strict Host Tenant Verification & Caller Scoping**: When a tenant user invokes visitor registration, view, approval, or rejection endpoints, `VisitorsController` enforces `tenantId === callerTenantId` matching the caller's verified `Tenant` record. Impersonation or unauthorized cross-tenant visitor manipulation is blocked with `403 Forbidden`.
- **Operating Model Status State Machine**:
  - `CHECKED_IN`: `isApproved === true` and `exitTime === null`.
  - `CHECKED_OUT`: `exitTime !== null`.
  - `REJECTED`: `isApproved === false`.
  - `APPROVED`: Pre-registered future visitor approved for entry.
  - `PENDING`: Walk-in or invited visitor awaiting host resident approval.
- **Exit Time Chronological Validation**: `exitTime` must be greater than or equal to `entryTime`. Supplying an earlier exit time is rejected with `400 Bad Request`.
- **Duplicate Check-Out & State Transition Protection**: Checking out an already checked-out visitor returns `409 Conflict`. Approving or rejecting a visitor who has already checked out returns `409 Conflict`.
- **Multi-Tenant Fail-Closed Isolation**: Guard console gatepass lookup (`GET /api/v1/visitors/gatepass/:code`) and visitor queries enforce organization-level scoping and return `404 Not Found` without disclosing visitor data to foreign organizations.
- **Audit Logging**: All visitor events (`VISITOR_REGISTERED`, `VISITOR_CHECKED_IN`, `VISITOR_CHECKED_OUT`, `VISITOR_APPROVED`, `VISITOR_REJECTED`, `VISITOR_DELETED`) record the actor, timestamp, organization, and sanitized metadata snapshot.

---

## 15. Property & Room Inventory Security & Concurrency Safeguards (CORE-019)
- **Serial Number Concurrency Advisory Locking**: Uses `SELECT pg_advisory_xact_lock(hashtext('inventory_serial_' || propertyId || '_' || lower(normalizedSerialNumber)))` to serialize concurrent asset creation with the same serial number within a property. Under parallel concurrent creation attempts (e.g. 5 simultaneous calls), exactly 1 succeeds with `201 Created` and 4 return clean `409 Conflict`.
- **Asset Assignment Advisory Locking**: Uses `SELECT pg_advisory_xact_lock(hashtext('inventory_assign_' || id))` to serialize concurrent assignment, unassignment, and status mutation workflows on individual inventory items.
- **Operating Model Boundary Enforcement**:
  - `PG` Properties: Reject rental unit inventory assignment (`rentalUnitId`) with `400 Bad Request`. Enforce room existence in the specific PG property (`404 Not Found` if room does not belong to property or organization).
  - `RENTAL_HOUSE` Properties: Reject room inventory assignment (`roomId`) with `400 Bad Request`. Enforce rental unit existence in the specific rental property (`404 Not Found` if unit does not belong to property or organization).
  - Common Property Stock: Handled when both `roomId === null && rentalUnitId === null`.
- **Status Transition Safeguards**:
  - Assets marked `DISPOSED` or `UNDER_REPAIR` cannot be assigned to resident rooms or units (`400 Bad Request`).
  - Transitioning an asset to `DISPOSED` automatically unassigns the asset from any room or rental unit (`roomId: null, rentalUnitId: null`).
  - Unassigning an asset returns status to `AVAILABLE` (unless currently `UNDER_REPAIR` or `DISPOSED`).
- **Non-Negative Decimal Purchase Valuation**: Asset `purchasePrice` is validated to be non-negative (`purchasePrice >= 0`). Portfolio asset valuation in summary KPIs uses `Prisma.Decimal` summation across non-disposed items with purchase prices to ensure exact currency calculations.
- **Multi-Tenant Fail-Closed Scoping**: All inventory queries and mutations strictly scope to `property: { organizationId }` and return `404 Not Found` without disclosing resource existence if accessed across organization boundaries.
- **RBAC Matrix**:
  - `OWNER`, `PROPERTY_MANAGER`: Full management (`inventory.read`, `inventory.create`, `inventory.update`, `inventory.delete`).
  - `WARDEN`: Operational room assignment & condition grading (`inventory.read`, `inventory.create`, `inventory.update`).
  - `MAINTENANCE_STAFF`: Condition & repair updates (`inventory.read`, `inventory.update`).
  - `ACCOUNTANT`: Asset valuation audit access (`inventory.read`).
  - `TENANT`: Strictly blocked from inventory management (`403 Forbidden`).
- **Audit Logging**: All inventory events (`INVENTORY_CREATED`, `INVENTORY_UPDATED`, `INVENTORY_ASSIGNED`, `INVENTORY_UNASSIGNED`, `INVENTORY_CONDITION_CHANGED`, `INVENTORY_STATUS_CHANGED`, `INVENTORY_DELETED`) write immutable audit logs with sanitized item metadata snapshots.

---

## 16. Expense Security & Transaction-Scoped Advisory Locking (CORE-020)
- **Mutation Advisory Locking**: Serializes concurrent updates and deletions on individual expense records via transaction-scoped PostgreSQL advisory lock:
  ```sql
  SELECT pg_advisory_xact_lock(hashtext('expense_mutate_' || id))
  ```
  Prevents dirty read-modify-write race conditions and ensures consistent audit state transitions.
- **Strict Positive Amount Validation**: Every operational expense requires `amount > 0`. Zero (`amount = 0`) and negative values (`amount < 0`) are rejected at both Zod validation pipe and service layers with `400 Bad Request`.
- **Decimal Financial Precision**: Handled using `Prisma.Decimal` without JavaScript floating-point conversions. All aggregate summary KPIs (`totalExpenseAmount`, `currentMonthExpenseAmount`, and category breakdowns) use `Prisma.Decimal` summation.
- **Multi-Tenant Fail-Closed Isolation**: All expense queries (`GET /expenses`, `GET /expenses/:id`, `PATCH /expenses/:id`, `DELETE /expenses/:id`, `GET /expenses/summary`) strictly enforce caller `organizationId`. Target property existence is verified within caller organization (`404 Not Found` if foreign/nonexistent). Cross-organization access fails closed with `404 Not Found`.
- **RBAC Matrix Enforcement**:
  - `OWNER`: Full operational and financial access (`expense.read`, `expense.create`, `expense.update`, `expense.delete`).
  - `PROPERTY_MANAGER`: Full management access (`expense.read`, `expense.create`, `expense.update`, `expense.delete`).
  - `ACCOUNTANT`: Financial management and audit access (`expense.read`, `expense.create`, `expense.update`). Blocked from deletion (`403 Forbidden`).
  - `WARDEN`: Operational outlay logging (`expense.read`, `expense.create`). Blocked from updates and deletion (`403 Forbidden`).
  - `TENANT`, `SECURITY`, `MAINTENANCE_STAFF`: Strictly blocked from all expense endpoints (`403 Forbidden`).
- **Immutable Snapshot Audit Logging**: Every expense lifecycle event (`EXPENSE_CREATED`, `EXPENSE_UPDATED`, `EXPENSE_DELETED`, `EXPENSE_RECEIPT_UPLOADED`) records the actor user ID, organization ID, action name, resource ID, IP address, user agent, and a structured metadata snapshot. Deletion writes a complete resource snapshot to the audit log prior to record deletion.

