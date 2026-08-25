# Future Tenant Product — Data Model & Entity Mapping

This document maps all database models and relationships relevant to the future Phase 2 Tenant Application:

### 1. Read-Only Entities (Consumed by Tenant App)
- `Property`: Basic name, address, rules, amenities, property manager contact.
- `Room` / `Bed` / `RentalUnit`: Assigned room/bed identifier, floor, sharing type.
- `Invoice` / `InvoiceLine`: Itemized billing breakdown (amounts, due dates, payment status).
- `Payment`: Historical payment records, payment method, allocation details.
- `Agreement` / `AgreementTemplate`: Legal terms, signed PDF document links.
- `MealSubscription` / `MealPlan`: Subscribed mess plan, daily attendance records.
- `ElectricityReading` / `ElectricityCharge`: Sub-metered units consumed, tariff rates.

### 2. Tenant-Generated Entities (Shared with Owner Operations)
- `MaintenanceTicket`: Issues submitted by tenants with photos, auto-routed to owner Kanban.
- `MaintenanceComment` / `MaintenanceAttachment`: Resident communication with technicians.
- `VisitorRecord`: Guest pre-registration records (`GP-` code), approval statuses.
- `AgreementSignature`: Digital signature timestamps, IP addresses, signature images.

### 3. Tenant-Specific Ecosystem Entities
- `CommunityPost`: Announcements, rules, lost-and-found notices.
- `CommunityComment`: Resident threaded commentary.
- `MarketplaceListing`: Peer-to-peer items, condition grading, negotiation flags, seller contact.
- `ServiceRequest`: On-demand facility requests (cleaning, laundry, carpentry).
