# Future Tenant Product — Feature Catalog

This catalog documents the tenant-facing capabilities originally designed and tested in CORE milestones, now designated for the standalone **Phase 2 Tenant Application**:

| Feature ID | Original Milestone | Feature Title | Original Route | Description |
| :--- | :--- | :--- | :--- | :--- |
| **TENANT-001** | CORE-002 / CORE-003 | Tenant Mobile Auth & Profile | `/tenant/login`, `/tenant/profile` | Phone OTP / Argon2id authentication, profile management, stay history view. |
| **TENANT-002** | CORE-008 | Digital Self Check-In | `/tenant/checkin` | Resident onboarding review, document sign-off, inventory handover acknowledgement. |
| **TENANT-003** | CORE-010 | Digital Agreement Signer | `/tenant/agreements/[id]` | Tenant-facing digital signature capture, legal terms review, PDF download. |
| **TENANT-004** | CORE-011 | Tenant Payment Portal | `/tenant/payments` | Itemized invoice views, UPI / card payment gateway integration, instant rent receipts. |
| **TENANT-005** | CORE-013 | Resident Maintenance Desk | `/tenant/maintenance` | Maintenance ticket submission with photo uploads, real-time status tracker, staff ratings. |
| **TENANT-006** | CORE-018 | Resident Visitor Pre-Registration | `/tenant/visitors` | Guest pre-approval, instant QR / gatepass code generation (`GP-`), entry notification. |
| **TENANT-007** | CORE-024 | Property Discovery & Search | `/discover`, `/discover/[id]` | Omnichannel property search with Haversine distance calculations, filters, virtual tours. |
| **TENANT-008** | CORE-025 | Resident Community Board | `/community` | Property notice stream, resident discussion forum, category filtering, threaded comments. |
| **TENANT-009** | CORE-026 | Tenant Marketplace | `/marketplace` | Peer-to-peer second-hand goods board, condition grading, price negotiation, item reservation. |
| **TENANT-010** | CORE-027 | On-Demand Service Requests | `/services` | Booking room cleaning, laundry, appliance repair, packing/moving with preferred time slots. |
