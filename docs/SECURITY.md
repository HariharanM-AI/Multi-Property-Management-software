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

