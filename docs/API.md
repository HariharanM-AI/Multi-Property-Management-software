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
- `POST /api/v1/properties/:propertyId/electricity/readings` (Permission: `electricity.create`)
- `GET /api/v1/properties/:propertyId/electricity/readings` (Permission: `electricity.read`)
- `POST /api/v1/properties/:propertyId/electricity/rates` (Permission: `electricity.create`)
- `GET /api/v1/properties/:propertyId/electricity/rates` (Permission: `electricity.read`)
- `POST /api/v1/properties/:propertyId/electricity/charges/generate` (Permission: `electricity.create`)
- `GET /api/v1/properties/:propertyId/electricity/charges` (Permission: `electricity.read`)
- `GET /api/v1/properties/:propertyId/electricity/summary` (Permission: `electricity.read`)
- `GET /api/v1/tenants/:tenantId/electricity/summary` (Permission: `electricity.read`)

---

## 14. PG Meal Management (`/api/v1/properties/:propertyId/meals`)
- `POST /api/v1/properties/:propertyId/meals/plans` (Permission: `meal.create`)
- `GET /api/v1/properties/:propertyId/meals/plans` (Permission: `meal.read`)
- `GET /api/v1/properties/:propertyId/meals/plans/:planId` (Permission: `meal.read`)
- `PATCH /api/v1/properties/:propertyId/meals/plans/:planId` (Permission: `meal.update`)
- `POST /api/v1/properties/:propertyId/meals/subscriptions` (Permission: `meal.create`)
- `GET /api/v1/properties/:propertyId/meals/subscriptions` (Permission: `meal.read`)
- `PATCH /api/v1/properties/:propertyId/meals/subscriptions/:subscriptionId` (Permission: `meal.update`)
- `POST /api/v1/properties/:propertyId/meals/records` (Permission: `meal.create`)
- `POST /api/v1/properties/:propertyId/meals/records/bulk` (Permission: `meal.create`)
- `GET /api/v1/properties/:propertyId/meals/matrix` (Permission: `meal.read`)
- `GET /api/v1/properties/:propertyId/meals/records` (Permission: `meal.read`)
- `POST /api/v1/properties/:propertyId/meals/charges/generate` (Permission: `meal.create`)
- `GET /api/v1/properties/:propertyId/meals/charges` (Permission: `meal.read`)
- `GET /api/v1/properties/:propertyId/meals/summary` (Permission: `meal.read`)
- `GET /api/v1/tenants/:tenantId/meals/summary` (Permission: `meal.read`)

---

## 15. Maintenance & Work Order Management (`/api/v1/maintenance`)
- `POST /api/v1/maintenance/tickets` (Permission: `maintenance.create`) — Create maintenance ticket (PG room/bed/floor/common or Rental unit/common)
- `GET /api/v1/maintenance/tickets` (Permission: `maintenance.read`) — Search and filter tickets with pagination and sorting
- `GET /api/v1/maintenance/tickets/:id` (Permission: `maintenance.read`) — Get ticket details with timeline, comments, attachments
- `PATCH /api/v1/maintenance/tickets/:id` (Permission: `maintenance.update`) — Update ticket details, schedule, category, priority
- `POST /api/v1/maintenance/tickets/:id/assign` (Permission: `maintenance.assign`) — Assign staff member to ticket (OPEN -> ASSIGNED)
- `POST /api/v1/maintenance/tickets/:id/reassign` (Permission: `maintenance.assign`) — Reassign staff member
- `POST /api/v1/maintenance/tickets/:id/unassign` (Permission: `maintenance.assign`) — Unassign staff member (ASSIGNED -> OPEN)
- `POST /api/v1/maintenance/tickets/:id/start` (Permission: `maintenance.update`) — Start work on ticket (ASSIGNED/OPEN -> IN_PROGRESS)
- `POST /api/v1/maintenance/tickets/:id/complete` (Permission: `maintenance.complete`) — Complete work with actual cost & resolution notes (IN_PROGRESS/ASSIGNED -> COMPLETED)
- `POST /api/v1/maintenance/tickets/:id/verify` (Permission: `maintenance.verify`) — Manager verifies completed work (COMPLETED -> VERIFIED)
- `POST /api/v1/maintenance/tickets/:id/close` (Permission: `maintenance.close`) — Close verified ticket (VERIFIED/COMPLETED -> CLOSED)
- `POST /api/v1/maintenance/tickets/:id/cancel` (Permission: `maintenance.cancel`) — Cancel ticket with reason (OPEN/ASSIGNED/IN_PROGRESS -> CANCELLED)
- `POST /api/v1/maintenance/tickets/:id/comments` (Permission: `maintenance.comment`) — Post comment on ticket
- `GET /api/v1/maintenance/tickets/:id/comments` (Permission: `maintenance.read`) — Get all comments on ticket
- `POST /api/v1/maintenance/tickets/:id/attachments` (Permission: `maintenance.create`) — Add attachment metadata (BEFORE, AFTER, RECEIPT, INVOICE, OTHER)
- `GET /api/v1/maintenance/tickets/:id/attachments` (Permission: `maintenance.read`) — Get attachments on ticket
- `PATCH /api/v1/maintenance/tickets/:id/cost` (Permission: `maintenance.manage_cost`) — Update estimated & actual costs (Decimal protected)
- `POST /api/v1/maintenance/vendors` (Permission: `maintenance.manage_vendor`) — Register maintenance vendor
- `GET /api/v1/maintenance/vendors` (Permission: `maintenance.read`) — List maintenance vendors
- `GET /api/v1/maintenance/vendors/:id` (Permission: `maintenance.read`) — Get vendor details
- `PATCH /api/v1/maintenance/vendors/:id` (Permission: `maintenance.manage_vendor`) — Update vendor details
- `GET /api/v1/maintenance/summary` (Permission: `maintenance.read`) — Organization-wide maintenance KPIs and cost totals
- `GET /api/v1/properties/:propertyId/maintenance/summary` (Permission: `maintenance.read`) — Property-specific maintenance KPIs and cost totals
- `GET /api/v1/tenants/:tenantId/maintenance/summary` (Permission: `maintenance.read`) — Tenant-specific maintenance requests summary

