# Future Tenant Product — Resident Notifications Contract

This document specifies the notification channels, payload structures, and event triggers for resident alerts in Phase 2:

### Notification Delivery Channels
- **In-App Notification Feed**: Stored in PostgreSQL `notifications` table, retrieved via `/api/v1/tenant-portal/notifications`.
- **Push Notifications**: Firebase Cloud Messaging (FCM) / Apple APNs for mobile apps.
- **SMS / WhatsApp Gateway**: Transactional SMS/WhatsApp for critical payment dues and OTPs.

### Core Event Triggers
1. `RENT_DUE`: Triggered 5 days prior to invoice due date.
2. `PAYMENT_RECEIVED`: Instant confirmation after successful payment receipt.
3. `MAINTENANCE_UPDATED`: Real-time status update when a technician is dispatched or completes work.
4. `LEASE_EXPIRING`: Sent 30 days and 15 days before lease expiration with renewal action button.
5. `VISITOR_ARRIVAL`: Push alert when a guest arrives at the security desk.
6. `PROPERTY_ANNOUNCEMENT`: Broadcast notification when management posts an official notice.
