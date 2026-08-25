# Future Tenant Product — API Contracts

This document specifies the REST API contracts required for the Phase 2 Tenant Application:

### 1. Tenant Authentication & Session
- `POST /api/v1/tenant-auth/otp/send` — Send OTP to registered tenant phone.
- `POST /api/v1/tenant-auth/otp/verify` — Verify OTP and issue tenant session cookie / JWT token.
- `GET /api/v1/tenant-profile/me` — Return occupant details, active room/bed, lease dates, deposit balance.

### 2. Rent, Utilities & Invoices
- `GET /api/v1/tenant-portal/invoices` — List itemized invoices for authenticated tenant.
- `GET /api/v1/tenant-portal/invoices/:id` — Get detailed breakdown (rent, electricity, meals, maintenance).
- `POST /api/v1/tenant-portal/payments/checkout` — Initiate UPI / card payment order.
- `GET /api/v1/tenant-portal/payments/receipts/:id` — Download official payment receipt.

### 3. Maintenance Requests
- `GET /api/v1/tenant-portal/maintenance` — List maintenance tickets submitted by the resident.
- `POST /api/v1/tenant-portal/maintenance` — Submit a new maintenance ticket with photo attachments.
- `POST /api/v1/tenant-portal/maintenance/:id/comments` — Add comment or feedback.

### 4. Community & Marketplace
- `GET /api/v1/tenant-portal/community/feed` — Get property announcements and resident posts.
- `POST /api/v1/tenant-portal/community/posts` — Create a discussion post (GENERAL, LOST_AND_FOUND, EVENT).
- `POST /api/v1/tenant-portal/community/posts/:id/comments` — Add comment to post.
- `GET /api/v1/tenant-portal/marketplace/listings` — List second-hand items for the resident's property.
- `POST /api/v1/tenant-portal/marketplace/listings` — Create a peer-to-peer listing.
- `PATCH /api/v1/tenant-portal/marketplace/listings/:id/status` — Update listing status (`RESERVED`, `SOLD`).

### 5. Visitor Desk
- `POST /api/v1/tenant-portal/visitors/pre-register` — Generate gatepass code (`GP-`) for expected visitor.
- `GET /api/v1/tenant-portal/visitors/history` — View guest visit logs.
- `PATCH /api/v1/tenant-portal/visitors/:id/action` — Approve or reject unexpected visitor arrival.
