# PropertyOS — REST API Specification & Standards

## 1. Global API Standards
- **Base Route**: `/api/v1`
- **Protocol**: HTTPS (HTTP permitted in local development).
- **Request Payloads**: `Content-Type: application/json` or `multipart/form-data` (for media).
- **Authentication**: Secure HTTP-only cookies (`propertyos_session`) or `Authorization: Bearer <token>`.
- **Response Envelope**: Standard JSON envelope with `success`, `data`, `meta`, and `error`.

---

## 2. Authentication Endpoints (`/api/v1/auth`)
- `POST /api/v1/auth/register` (Public, Rate-limited)
- `POST /api/v1/auth/login` (Public, Rate-limited)
- `POST /api/v1/auth/logout` (Authenticated)
- `GET /api/v1/auth/me` (Authenticated)
- `POST /api/v1/auth/forgot-password` (Public, Rate-limited)
- `POST /api/v1/auth/reset-password` (Public, Rate-limited)

---

## 3. Organization Management (`/api/v1/organization`)
- `GET /api/v1/organization` (Permission: `organization.read`)
- `PATCH /api/v1/organization` (Permission: `organization.update`)

---

## 4. Team & Invitations (`/api/v1/team`, `/api/v1/invitations`)
- `GET /api/v1/team` (Permission: `team.read`)
- `PATCH /api/v1/team/:userId/role` (Permission: `team.update`)
- `POST /api/v1/team/:userId/deactivate` (Permission: `team.update`)
- `POST /api/v1/team/:userId/reactivate` (Permission: `team.update`)
- `DELETE /api/v1/team/:userId` (Permission: `team.remove`)
- `POST /api/v1/invitations` (Permission: `team.invite`)
- `GET /api/v1/invitations` (Permission: `team.read`)
- `POST /api/v1/invitations/accept` (Public, Rate-limited)
- `POST /api/v1/invitations/:id/resend` (Permission: `team.invite`)
- `DELETE /api/v1/invitations/:id` (Permission: `team.invite`)

---

## 5. Property Management (`/api/v1/properties`)

### 5.1 Amenities Catalog
- **Endpoint**: `GET /api/v1/properties/amenities`
- **Permission**: `property.read`
- **Response** (`200 OK`): List of 16 standard property amenities.

### 5.2 Create Property
- **Endpoint**: `POST /api/v1/properties`
- **Permission**: `property.create`
- **Rate Limit**: Applied (60 req / min)
- **Request Body**:
```json
{
  "name": "GreenGlen PG Residency",
  "propertyType": "PG",
  "description": "Premium co-living property in HSR Layout",
  "address": "#42, 14th Main Road, Sector 4",
  "locality": "HSR Layout",
  "city": "Bengaluru",
  "district": "Bengaluru Urban",
  "state": "Karnataka",
  "country": "India",
  "postalCode": "560102",
  "latitude": 12.9116,
  "longitude": 77.6389,
  "contactPhone": "9845012345",
  "contactEmail": "manager@greenglen.in",
  "amenityIds": ["wifi", "power_backup", "cctv"]
}
```
- **Response** (`201 Created`): Returns created property with assigned atomic reference code `PROP-000001` and resolved capabilities.

### 5.3 List Properties
- **Endpoint**: `GET /api/v1/properties`
- **Permission**: `property.read`
- **Query Parameters**:
  - `page` (default 1)
  - `pageSize` (default 10, max 100)
  - `propertyType` (`PG` | `RENTAL_HOUSE`)
  - `status` (`ACTIVE` | `ARCHIVED` | `INACTIVE`)
  - `city`
  - `search` (Search by property name, code, locality, or city)
- **Response** (`200 OK`): Paginated property list with `items`, `total`, `page`, `pageSize`, `totalPages`.

### 5.4 Get Property By ID
- **Endpoint**: `GET /api/v1/properties/:id`
- **Permission**: `property.read`
- **Response** (`200 OK`): Returns property details, configured amenities, media items, and model capabilities.

### 5.5 Update Property
- **Endpoint**: `PATCH /api/v1/properties/:id`
- **Permission**: `property.update`
- **Note**: `propertyType` (operating model) is **immutable** and cannot be altered.

### 5.6 Archive Property (Soft Delete)
- **Endpoint**: `POST /api/v1/properties/:id/archive`
- **Permission**: `property.delete`
- **Behavior**: Sets `status = 'ARCHIVED'` and `deletedAt = new Date()`. Hides property from standard listings. Writes `PROPERTY_ARCHIVED` audit log.

### 5.7 Restore Property
- **Endpoint**: `POST /api/v1/properties/:id/restore`
- **Permission**: `property.delete`
- **Behavior**: Clears `deletedAt = null` and sets `status = 'ACTIVE'`. Writes `PROPERTY_RESTORED` audit log.

### 5.8 Upload Property Media
- **Endpoint**: `POST /api/v1/properties/:id/media`
- **Permission**: `property.update`
- **Payload**: `multipart/form-data` with `file` (JPEG, PNG, WEBP, PDF) and optional `category` (`IMAGE` | `DOCUMENT` | `FLOOR_PLAN`).

### 5.9 Remove Property Media
- **Endpoint**: `DELETE /api/v1/properties/:id/media/:mediaId`
- **Permission**: `property.update`

---

## 6. PG Structure Inventory (`/api/v1/properties/:propertyId/...`)
All structure endpoints operate within a scoped property context.

### 6.1 Get PG Summary
- **Endpoint**: `GET /api/v1/properties/:propertyId/pg/summary`
- **Permission**: `property.read`
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "propertyId": "uuid",
    "totalFloors": 3,
    "totalRooms": 10,
    "totalBeds": 24,
    "availableBeds": 18,
    "occupiedBeds": 6,
    "reservedBeds": 0,
    "maintenanceBeds": 0,
    "blockedBeds": 0,
    "cleaningBeds": 0,
    "noticeBeds": 0,
    "occupancyRate": 25
  }
}
```

### 6.2 Floors CRUD
- `POST /api/v1/properties/:propertyId/floors` (Permission: `property.create`)
  - Request: `{ "floorNumber": 1, "name": "First Floor" }`
- `GET /api/v1/properties/:propertyId/floors` (Permission: `property.read`)
- `GET /api/v1/properties/:propertyId/floors/:floorId` (Permission: `property.read`)
- `PATCH /api/v1/properties/:propertyId/floors/:floorId` (Permission: `property.update`)
- `DELETE /api/v1/properties/:propertyId/floors/:floorId` (Permission: `property.delete` - blocked if occupied beds exist)

### 6.3 Rooms CRUD
- `POST /api/v1/properties/:propertyId/rooms` (Permission: `property.create`)
  - Request: `{ "floorId": "uuid", "roomNumber": "101", "sharingType": "DOUBLE", "capacity": 2, "baseRent": 6000, "autoGenerateBeds": true }`
- `GET /api/v1/properties/:propertyId/rooms` (Permission: `property.read`)
- `GET /api/v1/properties/:propertyId/rooms/:roomId` (Permission: `property.read`)
- `PATCH /api/v1/properties/:propertyId/rooms/:roomId` (Permission: `property.update`)
- `DELETE /api/v1/properties/:propertyId/rooms/:roomId` (Permission: `property.delete` - blocked if occupied beds exist)

### 6.4 Beds CRUD
- `POST /api/v1/properties/:propertyId/beds` (Permission: `property.create`)
  - Request: `{ "roomId": "uuid", "bedNumber": "101-A", "monthlyRent": 6000, "status": "AVAILABLE" }`
- `GET /api/v1/properties/:propertyId/beds` (Permission: `property.read`)
- `GET /api/v1/properties/:propertyId/beds/:bedId` (Permission: `property.read`)
- `PATCH /api/v1/properties/:propertyId/beds/:bedId` (Permission: `property.update`)
- `PATCH /api/v1/properties/:propertyId/beds/:bedId/status` (Permission: `property.update`)
  - Request: `{ "status": "OCCUPIED" }`
- `DELETE /api/v1/properties/:propertyId/beds/:bedId` (Permission: `property.delete` - blocked if occupied)

---

## 7. Whole-Unit Rentals (`/api/v1/properties/:propertyId/units`, `/leases`)
- `GET /api/v1/properties/:propertyId/rental/summary` (Permission: `property.read`)
- `POST /api/v1/properties/:propertyId/units` (Permission: `property.create`)
- `GET /api/v1/properties/:propertyId/units` (Permission: `property.read`)
- `GET /api/v1/properties/:propertyId/units/:unitId` (Permission: `property.read`)
- `PATCH /api/v1/properties/:propertyId/units/:unitId` (Permission: `property.update`)
- `DELETE /api/v1/properties/:propertyId/units/:unitId` (Permission: `property.delete`)
- `POST /api/v1/properties/:propertyId/leases` (Permission: `lease.create`)
- `GET /api/v1/properties/:propertyId/leases` (Permission: `lease.read`)
- `GET /api/v1/properties/:propertyId/leases/:leaseId` (Permission: `lease.read`)
- `PATCH /api/v1/properties/:propertyId/leases/:leaseId` (Permission: `lease.update`)
- `POST /api/v1/properties/:propertyId/leases/:leaseId/terminate` (Permission: `lease.terminate`)

---

## 8. Tenant & KYC Management (`/api/v1/tenants`)
- `POST /api/v1/tenants` (Permission: `tenant.create`)
- `GET /api/v1/tenants` (Permission: `tenant.read`)
- `GET /api/v1/tenants/:id` (Permission: `tenant.read`)
- `PATCH /api/v1/tenants/:id` (Permission: `tenant.update`)
- `DELETE /api/v1/tenants/:id` (Permission: `tenant.delete`)
- `POST /api/v1/tenants/:id/documents` (Permission: `tenant.create`)
- `POST /api/v1/tenants/:id/documents/:docId/verify` (Permission: `tenant.verify`)
- `DELETE /api/v1/tenants/:id/documents/:docId` (Permission: `tenant.delete`)

---

## 9. Digital Onboarding & Check-In (`/api/v1/check-ins`, `/properties/:propertyId/check-ins`)
- `GET /api/v1/tenants/:tenantId/onboarding-status` (Permission: `checkin.read`)
- `POST /api/v1/properties/:propertyId/check-ins` (Permission: `checkin.create`)
- `GET /api/v1/properties/:propertyId/check-ins` (Permission: `checkin.read`)
- `GET /api/v1/check-ins/:checkInId` (Permission: `checkin.read`)
- `POST /api/v1/check-ins/:checkInId/ready` (Permission: `checkin.update`)
- `POST /api/v1/check-ins/:checkInId/complete` (Permission: `checkin.complete`)
- `POST /api/v1/check-ins/:checkInId/cancel` (Permission: `checkin.cancel`)

---

## 10. Digital Notice & Check-Out Settlement (`/api/v1/checkouts`, `/properties/:propertyId/checkouts`)
- `POST /api/v1/properties/:propertyId/checkouts` (Permission: `checkout.create`)
- `GET /api/v1/properties/:propertyId/checkouts` (Permission: `checkout.read`)
- `GET /api/v1/checkouts/:checkoutId` (Permission: `checkout.read`)
- `GET /api/v1/checkouts/:checkoutId/settlement` (Permission: `checkout.read`)
- `PATCH /api/v1/checkouts/:checkoutId/settlement` (Permission: `checkout.update`)
- `POST /api/v1/checkouts/:checkoutId/ready` (Permission: `checkout.update`)
- `POST /api/v1/checkouts/:checkoutId/complete` (Permission: `checkout.complete`)
- `POST /api/v1/checkouts/:checkoutId/cancel` (Permission: `checkout.cancel`)

---

## 11. Digital Agreements & Signatures (`/api/v1/agreements`, `/agreement-templates`)
- `POST /api/v1/agreement-templates` (Permission: `agreement.create`)
- `GET /api/v1/agreement-templates` (Permission: `agreement.read`)
- `PATCH /api/v1/agreement-templates/:templateId` (Permission: `agreement.update`)
- `POST /api/v1/agreement-templates/:templateId/activate` (Permission: `agreement.update`)
- `POST /api/v1/agreement-templates/:templateId/archive` (Permission: `agreement.delete`)
- `POST /api/v1/properties/:propertyId/agreements` (Permission: `agreement.create`)
- `GET /api/v1/agreements/:agreementId` (Permission: `agreement.read`)
- `POST /api/v1/agreements/:agreementId/generate` (Permission: `agreement.create`)
- `POST /api/v1/agreements/:agreementId/send-for-signature` (Permission: `agreement.update`)
- `POST /api/v1/agreements/:agreementId/sign` (Permission: `agreement.sign`)
- `POST /api/v1/agreements/:agreementId/finalize` (Permission: `agreement.finalize`)
- `POST /api/v1/agreements/:agreementId/cancel` (Permission: `agreement.cancel`)

---

## 12. Billing, Invoicing & Double-Entry Ledger (`/api/v1/billing`, `/invoices`, `/payments`, `/ledger`)
- `POST /api/v1/billing/charges` (Permission: `billing.create`)
- `GET /api/v1/billing/charges` (Permission: `billing.read`)
- `POST /api/v1/billing/schedules` (Permission: `billing.create`)
- `GET /api/v1/billing/schedules` (Permission: `billing.read`)
- `POST /api/v1/billing/generate-due` (Permission: `billing.create`)
- `POST /api/v1/invoices` (Permission: `billing.create`)
- `GET /api/v1/invoices` (Permission: `billing.read`)
- `GET /api/v1/invoices/:id` (Permission: `billing.read`)
- `POST /api/v1/invoices/:id/issue` (Permission: `billing.update`)
- `POST /api/v1/invoices/:id/void` (Permission: `billing.update`)
- `POST /api/v1/payments` (Permission: `payment.create`)
- `GET /api/v1/payments` (Permission: `payment.read`)
- `POST /api/v1/payments/:id/allocate` (Permission: `payment.create`)
- `GET /api/v1/ledger` (Permission: `ledger.read`)
- `GET /api/v1/ledger/tenant/:tenantId` (Permission: `ledger.read`)
- `GET /api/v1/ledger/invoice/:invoiceId` (Permission: `ledger.read`)
- `GET /api/v1/financials/tenant/:tenantId` (Permission: `billing.read`)
- `GET /api/v1/financials/property/:propertyId` (Permission: `billing.read`)
- `GET /api/v1/financials/organization` (Permission: `billing.read`)

---

## 13. Electricity Management (`/api/v1/properties/:propertyId/electricity`)
- `POST /api/v1/properties/:propertyId/electricity/meters` (Permission: `electricity.create`)
- `GET /api/v1/properties/:propertyId/electricity/meters` (Permission: `electricity.read`)
- `GET /api/v1/properties/:propertyId/electricity/meters/:meterId` (Permission: `electricity.read`)
- `PATCH /api/v1/properties/:propertyId/electricity/meters/:meterId` (Permission: `electricity.update`)
- `POST /api/v1/properties/:propertyId/electricity/readings` (Permission: `electricity.create`, reset override requires `electricity.update`)
- `GET /api/v1/properties/:propertyId/electricity/readings` (Permission: `electricity.read`)
- `POST /api/v1/properties/:propertyId/electricity/rates` (Permission: `electricity.create`, protected by property advisory lock and non-overlap verification)
- `GET /api/v1/properties/:propertyId/electricity/rates` (Permission: `electricity.read`)
- `PATCH /api/v1/properties/:propertyId/electricity/rates/:rateId/deactivate` (Permission: `electricity.update`)
- `POST /api/v1/properties/:propertyId/electricity/charges/generate` (Permission: `electricity.create`, protected by reading advisory lock and atomic transaction client propagation)
- `GET /api/v1/properties/:propertyId/electricity/charges` (Permission: `electricity.read`)
- `GET /api/v1/properties/:propertyId/electricity/summary` (Permission: `electricity.read`)
- `GET /api/v1/tenants/:tenantId/electricity/summary` (Permission: `electricity.read`)

---

## 14. PG Meal Management (`/api/v1/properties/:propertyId/meals`)
- `POST /api/v1/properties/:propertyId/meals/plans` (Permission: `meal.create`, validates price > 0, at least one meal flag true, name unique per property with PostgreSQL advisory locking)
- `GET /api/v1/properties/:propertyId/meals/plans` (Permission: `meal.read`)
- `GET /api/v1/properties/:propertyId/meals/plans/:planId` (Permission: `meal.read`)
- `PATCH /api/v1/properties/:propertyId/meals/plans/:planId` (Permission: `meal.update`, validates price > 0, at least one meal flag true)
- `POST /api/v1/properties/:propertyId/meals/subscriptions` (Permission: `meal.create`, validates tenant active check-in stay, rejects overlapping active date ranges with 409 Conflict using advisory lock)
- `GET /api/v1/properties/:propertyId/meals/subscriptions` (Permission: `meal.read`)
- `PATCH /api/v1/properties/:propertyId/meals/subscriptions/:subscriptionId` (Permission: `meal.update`)
- `POST /api/v1/properties/:propertyId/meals/records` (Permission: `meal.create`, validates active stay, upserts attendance deterministically)
- `POST /api/v1/properties/:propertyId/meals/records/bulk` (Permission: `meal.create`, single-transaction atomic bulk recording across all tenant entries)
- `GET /api/v1/properties/:propertyId/meals/matrix` (Permission: `meal.read`, returns daily tenant meal attendance matrix)
- `GET /api/v1/properties/:propertyId/meals/records` (Permission: `meal.read`)
- `POST /api/v1/properties/:propertyId/meals/charges/generate` (Permission: `meal.create`, protected by PostgreSQL advisory locking, idempotent charge return, single-transaction atomic invoice and ledger generation)
- `GET /api/v1/properties/:propertyId/meals/charges` (Permission: `meal.read`)
- `GET /api/v1/properties/:propertyId/meals/summary` (Permission: `meal.read`)
- `GET /api/v1/tenants/:tenantId/meals/summary` (Permission: `meal.read`)

---

## 15. Maintenance & Work Order Management (`/api/v1/maintenance`) (CORE-013 & CORE-016 Hardening)
- `POST /api/v1/maintenance/tickets` (Permission: `maintenance.create`) — Create maintenance ticket. Enforces operating model targeting (PG room/bed/floor/common vs Rental unit/common), sequence generation protected by `pg_advisory_xact_lock(hashtext('ticket_seq_' || organizationId))`, generates `TKT-YYYY-NNNNNN` ticket numbering.
- `GET /api/v1/maintenance/tickets` (Permission: `maintenance.read`) — Search and filter tickets with pagination and sorting. Automatically sanitizes internal costs (`estimatedCost`, `actualCost`) to `null` for tenant role callers.
- `GET /api/v1/maintenance/tickets/:id` (Permission: `maintenance.read`) — Get ticket details with timeline, comments, attachments. Sanitizes internal costs to `null` for tenant callers.
- `PATCH /api/v1/maintenance/tickets/:id` (Permission: `maintenance.update`) — Update ticket details, schedule, category, priority. Tenant users receive `403 Forbidden` if attempting to modify cost fields.
- `POST /api/v1/maintenance/tickets/:id/assign` (Permission: `maintenance.assign`) — Assign staff member to ticket (`OPEN -> ASSIGNED`). Serialized via `pg_advisory_xact_lock(hashtext('ticket_transition_' || ticketId))`.
- `POST /api/v1/maintenance/tickets/:id/reassign` (Permission: `maintenance.assign`) — Reassign staff member to another staff user within the organization.
- `POST /api/v1/maintenance/tickets/:id/unassign` (Permission: `maintenance.assign`) — Unassign staff member (`ASSIGNED -> OPEN`). Clears `assignedToId` and records audit status transition.
- `POST /api/v1/maintenance/tickets/:id/start` (Permission: `maintenance.update` / `maintenance.complete`) — Start work on ticket (`OPEN/ASSIGNED -> IN_PROGRESS`). Serialized via transaction-scoped advisory locking.
- `POST /api/v1/maintenance/tickets/:id/complete` (Permission: `maintenance.complete`) — Complete work with actual cost & resolution notes (`ASSIGNED/IN_PROGRESS -> COMPLETED`).
- `POST /api/v1/maintenance/tickets/:id/verify` (Permission: `maintenance.verify`) — Manager verifies completed work (`COMPLETED -> VERIFIED`). Invalid state jumps rejected with `409 Conflict`.
- `POST /api/v1/maintenance/tickets/:id/close` (Permission: `maintenance.close`) — Close verified ticket (`VERIFIED/COMPLETED -> CLOSED`). Sets `closedAt`, immutable terminal state.
- `POST /api/v1/maintenance/tickets/:id/cancel` (Permission: `maintenance.cancel`) — Cancel ticket with mandatory reason (`OPEN/ASSIGNED/IN_PROGRESS -> CANCELLED`). Cannot cancel already CLOSED or CANCELLED tickets (`409 Conflict`).
- `POST /api/v1/maintenance/tickets/:id/comments` (Permission: `maintenance.comment`) — Post comment on ticket with author tracking and audit trail.
- `GET /api/v1/maintenance/tickets/:id/comments` (Permission: `maintenance.read`) — Get all comments on ticket.
- `POST /api/v1/maintenance/tickets/:id/attachments` (Permission: `maintenance.create`) — Add attachment metadata (`BEFORE`, `AFTER`, `RECEIPT`, `INVOICE`, `OTHER`).
- `GET /api/v1/maintenance/tickets/:id/attachments` (Permission: `maintenance.read`) — Get attachments on ticket.
- `PATCH /api/v1/maintenance/tickets/:id/cost` (Permission: `maintenance.manage_cost`) — Update estimated & actual costs (non-negative Decimal validation, 403 Forbidden for tenants).
- `POST /api/v1/maintenance/vendors` (Permission: `maintenance.manage_vendor`) — Register maintenance vendor. Concurrency deduplication serialized via `pg_advisory_xact_lock(hashtext('vendor_' || organizationId || '_' || lower(name)))`. Duplicate names return `409 Conflict`.
- `GET /api/v1/maintenance/vendors` (Permission: `maintenance.read`) — List maintenance vendors within organization.
- `GET /api/v1/maintenance/vendors/:id` (Permission: `maintenance.read`) — Get vendor details (fail-closed 404 for cross-organization access).
- `PATCH /api/v1/maintenance/vendors/:id` (Permission: `maintenance.manage_vendor`) — Update vendor details.
- `GET /api/v1/maintenance/summary` (Permission: `maintenance.read`) — Organization-wide maintenance KPIs and cost totals.
- `GET /api/v1/properties/:propertyId/maintenance/summary` (Permission: `maintenance.read`) — Property-specific maintenance KPIs and cost totals.
- `GET /api/v1/tenants/:tenantId/maintenance/summary` (Permission: `maintenance.read`) — Tenant-specific maintenance requests summary.

---

## 16. Staff & Attendance Management (`/api/v1/staff`) (CORE-017)
- `POST /api/v1/staff` (Permission: `staff.create`) — Register new staff member (warden, guard, cleaner, cook, maintenance, etc.). Supports optional User account linking, optional Property assignment, non-negative monthly salary validation (`salaryMonthly >= 0` Decimal(10,2), zero salary allowed), and concurrency-protected phone deduplication serialized via `SELECT pg_advisory_xact_lock(hashtext('staff_create_' || organizationId || '_' || normalizedPhone))`. Duplicate active phone returns `409 Conflict`.
- `GET /api/v1/staff` (Permission: `staff.read`) — List staff members scoped to caller organization with filters (`propertyId`, `isActive`, `search`) and pagination (`page`, `limit`).
- `GET /api/v1/staff/:id` (Permission: `staff.read`) — Get staff member details by ID with assigned property and user information. Fails closed (`404 Not Found`) on cross-organization access.
- `PATCH /api/v1/staff/:id` (Permission: `staff.update`) — Update staff member profile, role title, phone, salary (non-negative Decimal validation), property assignment, or active status.
- `DELETE /api/v1/staff/:id` (Permission: `staff.delete`) — Safe deactivation endpoint (`isActive = false`). Strictly preserves StaffMember record, attendance history, and audit trail without physical database deletion.
- `GET /api/v1/staff/summary` (Permission: `staff.read`) — Fetch real-time aggregated staff KPIs (`totalStaff`, `activeStaff`, `inactiveStaff`, `presentToday`, `absentToday`, `onLeaveToday`) and authoritative monthly payroll total calculated using `Prisma.Decimal` summation.
- `POST /api/v1/staff/attendance/check-in` (Permission: `attendance.record`) — Record daily check-in for active staff member. Serialized via `SELECT pg_advisory_xact_lock(hashtext('staff_att_' || staffMemberId || '_' || YYYY-MM-DD))`. Sets `status: PRESENT` and `checkInTime`. Duplicate check-in on same calendar date returns clean `409 Conflict`. Inactive staff check-in rejected with `400 Bad Request`.
- `POST /api/v1/staff/attendance/check-out` (Permission: `attendance.record`) — Record daily check-out time on existing attendance record for date. Check-out without check-in returns `404 Not Found`.
- `POST /api/v1/staff/attendance/record` (Permission: `attendance.update`) — Manual attendance upsert for staff member on specified date with status (`PRESENT`, `ABSENT`, `HALF_DAY`, `LEAVE`) and optional check-in/out times. Serialized via advisory lock.
- `GET /api/v1/staff/attendance/records` (Permission: `attendance.read`) — Query attendance records scoped to organization with filters (`propertyId`, `staffMemberId`, `date`, `startDate`, `endDate`, `status`) and pagination.

---

## 17. Visitor & Gatepass Management (`/api/v1/visitors`) (CORE-018)
- `POST /api/v1/visitors` (Permission: `visitor.create`) — Register new visitor or pre-register resident guest. Generates unique collision-safe gatepass code (`GP-YYYYMMDD-XXXX`) serialized via `pg_advisory_xact_lock(hashtext('visitor_gp_' || gatePassCode))`. Validates 10-digit Indian phone, property & host tenant existence in caller organization. If caller is tenant-only role, strictly enforces `tenantId === caller.tenantId` (`403 Forbidden` on spoofing attempts). Default status is pre-approved (`isApproved = true`).
- `GET /api/v1/visitors` (Permission: `visitor.read`) — List visitor records scoped to organization with filters (`propertyId`, `tenantId`, `status`: `CHECKED_IN` / `CHECKED_OUT` / `APPROVED` / `PENDING` / `REJECTED`, `search`, `startDate`, `endDate`) and pagination (`page`, `limit`). Tenant callers are automatically scoped to only their own hosted visitors.
- `GET /api/v1/visitors/summary` (Permission: `visitor.read`) — Fetch real-time visitor KPIs (`totalVisitorsToday`, `activeVisitorsInside`, `expectedVisitors`, `totalVisitorsThisMonth`). Supports optional `propertyId` scoping and automatic tenant-level scoping for tenant callers.
- `GET /api/v1/visitors/gatepass/:code` (Permission: `visitor.read`) — Instant gatepass code lookup for security guards and console verification. Case-insensitive lookup, resolves resident room/bed or unit number. Fails closed (`404 Not Found`) across organization boundaries.
- `GET /api/v1/visitors/:id` (Permission: `visitor.read`) — Get single visitor record by ID with room/unit resolution and host details. Fails closed with `404 Not Found` for cross-org access, `403 Forbidden` for tenant accessing another host's visitor.
- `POST /api/v1/visitors/:id/check-in` (Permission: `visitor.update`, `@HttpCode(200)`) — Security desk check-in (record physical arrival). Serialized via `pg_advisory_xact_lock(hashtext('visitor_checkin_' || id))`. Rejects unapproved visitors (`403 Forbidden`) and already completed visits (`409 Conflict`). Updates `entryTime` and writes `VISITOR_CHECKED_IN` audit log.
- `POST /api/v1/visitors/:id/check-out` (Permission: `visitor.update`, `@HttpCode(200)`) — Security desk check-out (record physical exit). Serialized via `pg_advisory_xact_lock(hashtext('visitor_checkout_' || id))`. Validates `exitTime >= entryTime` (`400 Bad Request`). Duplicate check-out attempts return clean `409 Conflict`. Sets `exitTime`, transitions status to `CHECKED_OUT`, and writes `VISITOR_CHECKED_OUT` audit log.
- `POST /api/v1/visitors/:id/approve` (Permission: `visitor.update`, `@HttpCode(200)`) — Host tenant or manager approves visitor for entry (`isApproved = true`). Tenant callers can only approve their own visitors (`403 Forbidden` otherwise). Cannot modify already checked-out visitor (`409 Conflict`). Writes `VISITOR_APPROVED` audit log.
- `POST /api/v1/visitors/:id/reject` (Permission: `visitor.update`, `@HttpCode(200)`) — Host tenant or manager rejects visitor entry (`isApproved = false`, status becomes `REJECTED`). Tenant callers can only reject their own visitors. Cannot reject already checked-out visitor (`409 Conflict`). Writes `VISITOR_REJECTED` audit log.
- `DELETE /api/v1/visitors/:id` (Permission: `visitor.delete`) — Delete visitor record (Owner / Property Manager only). Writes `VISITOR_DELETED` snapshot audit log and removes record from database. Tenant callers blocked with `403 Forbidden`.

---

## 18. Property & Room Inventory Tracking (`/api/v1/inventory`) (CORE-019)
- `POST /api/v1/inventory` (Permission: `inventory.create`) — Create new inventory item (appliances, furniture, electronics, linen, etc.). Validates property ownership and dual operating model constraints (PG properties reject `rentalUnitId` with `400 Bad Request`; Rental properties reject `roomId` with `400 Bad Request`). Enforces non-negative `purchasePrice >= 0` with `Prisma.Decimal(10,2)` precision. Serial number deduplication is protected via `SELECT pg_advisory_xact_lock(hashtext('inventory_serial_' || propertyId || '_' || lower(serialNumber)))` (duplicate active serials return `409 Conflict`). Defaults status to `ASSIGNED` if room/unit target provided, or `AVAILABLE` (in-stock) if common. Writes `INVENTORY_CREATED` audit log.
- `GET /api/v1/inventory` (Permission: `inventory.read`) — List inventory items scoped to organization with filters (`propertyId`, `roomId`, `rentalUnitId`, `category`, `condition`, `status`, `search`) and pagination (`page`, `pageSize`, `total`, `totalPages`). Maps room/unit numbers into user-friendly `locationDisplay`.
- `GET /api/v1/inventory/summary` (Permission: `inventory.read`) — Fetch aggregated inventory KPIs (`totalItems`, `assignedItems`, `availableItems`, `underRepairItems`, `damagedItems`) and authoritative `totalAssetValue` calculated using `Prisma.Decimal` summation across all active (non-disposed) assets with non-null purchase prices. Supports optional `propertyId` scoping.
- `GET /api/v1/inventory/:id` (Permission: `inventory.read`) — Get single inventory item details by ID. Fails closed (`404 Not Found`) for non-existent items or cross-organization requests.
- `PATCH /api/v1/inventory/:id` (Permission: `inventory.update`) — Update inventory item name, category, serial number, condition (`NEW`, `GOOD`, `FAIR`, `POOR`, `DAMAGED`), status (`AVAILABLE`, `ASSIGNED`, `UNDER_REPAIR`, `DISPOSED`), or purchase price. Serialized via `pg_advisory_xact_lock(hashtext('inventory_assign_' || id))`. Transitioning status to `DISPOSED` automatically unassigns the asset from any room or rental unit. Writes `INVENTORY_CONDITION_CHANGED`, `INVENTORY_STATUS_CHANGED`, or `INVENTORY_UPDATED` audit logs.
- `POST /api/v1/inventory/:id/assign` (Permission: `inventory.update`) — Assign or reassign inventory asset to a room (for PG) or rental unit (for Rental House). Serialized via advisory lock `pg_advisory_xact_lock(hashtext('inventory_assign_' || id))`. Blocks assignment if asset is `UNDER_REPAIR` or `DISPOSED` (`400 Bad Request`). Validates target room/unit in property. Sets status to `ASSIGNED` and writes `INVENTORY_ASSIGNED` audit log.
- `POST /api/v1/inventory/:id/unassign` (Permission: `inventory.update`) — Unassign inventory asset from room/unit back to common property stock. Serialized via advisory lock. Clears `roomId` and `rentalUnitId`, updates status to `AVAILABLE` (or preserves `UNDER_REPAIR` / `DISPOSED`), and writes `INVENTORY_UNASSIGNED` audit log.
- `DELETE /api/v1/inventory/:id` (Permission: `inventory.delete`) — Permanently delete inventory item. Serialized via advisory lock. Records `INVENTORY_DELETED` snapshot audit log and deletes record from database. Fails closed (`404 Not Found`) for cross-organization access.

---

## 19. Expense Management & Operational Overheads (`/api/v1/expenses`) (CORE-020)
- `GET /api/v1/expenses/categories` (Permission: `expense.read`) — Fetch all seeded operational expense categories (`SALARY`, `ELECTRICITY`, `WATER`, `FOOD`, `MAINTENANCE`, `CLEANING`, `INTERNET`, `SUPPLIES`, `PROPERTY_TAX`, `OTHER`). Idempotently seeds standard categories if not present.
- `POST /api/v1/expenses` (Permission: `expense.create`) — Record a new operational expense. Enforces positive monetary amounts (`amount > 0` with `Prisma.Decimal(10,2)` precision). Validates property ownership within caller organization (`404 Not Found` if foreign/nonexistent). Validates category name or UUID. Supports optional vendor name, notes, and uploaded receipt URL. Writes `EXPENSE_CREATED` audit log.
- `GET /api/v1/expenses` (Permission: `expense.read`) — List expense records scoped to caller organization with filters (`propertyId`, `categoryId`, `categoryName`, `startDate`, `endDate`, `minAmount`, `maxAmount`, `search`) and pagination (`page`, `limit`, `total`, `totalPages`). Multi-tenant fail-closed isolation ensures 0 records returned for cross-org requests.
- `GET /api/v1/expenses/summary` (Permission: `expense.read`) — Fetch aggregated real-time financial expense KPIs (`totalExpenseAmount`, `totalExpenseCount`, `currentMonthExpenseAmount`, `categoryBreakdown`) computed using `Prisma.Decimal` summation across organization or specific `propertyId`.
- `GET /api/v1/expenses/:id` (Permission: `expense.read`) — Get single expense record by ID with category and property details. Fails closed (`404 Not Found`) for cross-organization requests.
- `PATCH /api/v1/expenses/:id` (Permission: `expense.update`) — Update expense title, amount (positive `Decimal`), expense date, category, property, vendor name, receipt URL, or notes. Mutations are serialized via transaction-scoped PostgreSQL advisory lock `SELECT pg_advisory_xact_lock(hashtext('expense_mutate_' || id))`. Fails closed (`404 Not Found`) for cross-org requests. Writes `EXPENSE_UPDATED` audit log.
- `DELETE /api/v1/expenses/:id` (Permission: `expense.delete`) — Delete expense record (Owner / Property Manager only; Accountant and Warden blocked with `403 Forbidden`). Mutations serialized via `pg_advisory_xact_lock(hashtext('expense_mutate_' || id))`. Writes immutable `EXPENSE_DELETED` snapshot audit log before deleting record. Fails closed (`404 Not Found`) for cross-organization requests.
- `POST /api/v1/expenses/upload-receipt` (Permission: `expense.create`, `multipart/form-data`) — Upload invoice/receipt attachment (PNG, JPEG, PDF up to 10MB) stored under `'expense_receipts'` category. Returns public/signed file URL.

---

## 20. Reports & Financial Analytics (`/api/v1/reports`) (CORE-021)
- `GET /api/v1/reports/pnl` (Permission: `reports.read`) — Generates real-time authoritative Profit & Loss Statement using pure deterministic `Prisma.Decimal` arithmetic. Aggregates Invoiced Revenue from `Invoice` & `InvoiceLine`, Realized Collected Revenue from `Payment` (`status: RECORDED`), Operational Expenses from `ExpenseRecord`, Net Operating Income (Cash NOI = Collected - Expenses), Accrual NOI (Invoiced - Expenses), Outstanding Revenue (Invoiced - Collected), Operating Margin %, category breakdowns, and monthly time-series trend bucketing. Supports filters `propertyId`, `startDate`, `endDate`, `period` (`monthly`, `quarterly`, `yearly`, `custom`). Fails closed (`404 Not Found`) on foreign property queries.
- `GET /api/v1/reports/occupancy` (Permission: `reports.read`) — Generates Occupancy & Capacity Report. Computes PG bed capacity & utilization (`Bed` status `OCCUPIED` vs total beds), Whole-Unit rental capacity & occupancy (`RentalUnit` status `OCCUPIED` vs total units), and blended portfolio occupancy rate. Supports `propertyId` filter.
- `GET /api/v1/reports/property-comparison` (Permission: `reports.read`) — Multi-property financial and operational comparison matrix across all properties in the organization. Computes property-level invoiced revenue, collected revenue, operational expenses, net operating income, profit margin %, and occupancy %. Supports `startDate`, `endDate`, and `period` filters.
- `GET /api/v1/reports/cash-flow` (Permission: `reports.read`) — Realized Cash Flow Statement analyzing actual cash movements. Aggregates cash inflows (tenant payments grouped by method `UPI`, `BANK_TRANSFER`, `CASH`, `CARD`, `CHEQUE`, `OTHER`), cash outflows (operational expenses by category), and net cash flow. Supports `propertyId`, `startDate`, `endDate`, and `period` filters.
- `GET /api/v1/reports/export` (Permission: `reports.read`) — Generates RFC 4180-compliant CSV export for `reportType` (`pnl`, `occupancy`, `property_comparison`, `cash_flow`). Implements spreadsheet formula injection protection (neutralizes leading `=`, `+`, `-`, `@` characters) and writes immutable `REPORT_EXPORTED` audit log with export metadata.

---

## 21. Multi-Property Owner Dashboard (`/api/v1/dashboard`) (CORE-022)
- `GET /api/v1/dashboard/summary` (Permission: `dashboard.read`) — Executive portfolio mission control aggregating real-time portfolio metrics across PG and Rental House properties:
  - **KPI StatCards**: `activeProperties` / `totalProperties`, `pgCount`, `rentalCount`, `activeTenantsCount`, and `urgentActionItemsCount`.
  - **Portfolio Capacity & Occupancy**: `totalBeds`, `occupiedBeds`, `availableBeds`, `totalUnits`, `occupiedUnits`, `availableUnits`, and `blendedOccupancyRate` percentage (safely handles zero capacity with `0.00%`).
  - **Current Calendar Month Financials**: Real-time `Prisma.Decimal` arithmetic computing `invoicedRevenue` (from current month invoice lines), `collectedRevenue` (from current month recorded payments), `operationalExpenses` (from current month expense records), `netOperatingIncome` (Cash NOI = Collected - Expenses), `outstandingReceivables` (sum of unpaid active invoice balances across org), and `operatingMarginPercentage`.
  - **Property Performance Cards**: Individual property cards containing capacity counts, occupancy rate %, occupancy status badges (`FULL`, `HIGH_OCCUPANCY`, `NORMAL`, `LOW_OCCUPANCY`, `VACANT`), monthly invoiced/collected/expense/net income, open/in-progress maintenance ticket counts with urgent indicator, and pending invoice totals.
  - **Filters**: Supports `propertyType` (`ALL`, `PG`, `RENTAL_HOUSE`), `city`, and `status` (`ALL`, `ACTIVE`, `INACTIVE`).
- `GET /api/v1/dashboard/action-items` (Permission: `dashboard.read`) — Urgent operational triage alerts requiring property management attention:
  - **Overdue Invoices**: Unpaid active invoices (`dueDate < now && outstandingAmount > 0`), ordered descending by `daysOverdue`. Includes tenant name, phone, property name, invoice number, and outstanding amount.
  - **Urgent Maintenance Tickets**: Tickets in `OPEN`, `ASSIGNED`, or `IN_PROGRESS` with priority `HIGH` or `URGENT`, ordered ascending by creation date (oldest unresolved first) with room/unit location context.
  - **Upcoming Lease Renewals**: Active leases on rental units ending within the next 60 days (`endDate >= now && endDate <= now + 60 days`), showing tenant details, unit number, monthly rent, and days remaining.
  - **Total Count**: `totalActionItemsCount` aggregate.
- `GET /api/v1/dashboard/activity` (Permission: `dashboard.read`) — Chronological stream of the 10 most recent operational events across the organization:
  - `PAYMENT_RECEIVED`: Recorded tenant payments with amount and property name.
  - `MAINTENANCE_CREATED` / `MAINTENANCE_COMPLETED`: Work orders logged or completed with ticket number and cost.
  - `TENANT_CHECKED_IN`: Digital resident check-in completions.
  - `EXPENSE_RECORDED`: Operational expenses logged with category and amount.


