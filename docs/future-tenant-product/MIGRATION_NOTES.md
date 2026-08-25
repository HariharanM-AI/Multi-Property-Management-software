# Future Tenant Product — Phase 2 Migration Notes

## Step-by-Step Bootstrapping Guide for Phase 2

1. **Repository Setup**:
   - Create a dedicated repository (or standalone workspace `apps/tenant-web` or `apps/tenant-mobile`).
2. **API Gateway & Auth**:
   - Connect to PropertyOS Tenant API Gateway (`/api/v1/tenant-portal/*`).
   - Implement Phone OTP authentication verifying against `Tenant.phone` and active `TenantStayHistory`.
3. **Frontend Implementation**:
   - Utilize the UI route blueprints in [UI_ROUTES.md](file:///c:/Users/user/Desktop/Property%20Management%20Software/docs/future-tenant-product/UI_ROUTES.md).
   - Re-use design tokens from `@propertyos/config` (Tailwind palette, typography, icons).
4. **Payment Gateway Integration**:
   - Wire Razorpay / Cashfree / Stripe webhook endpoints to create real-time `Payment` and `PaymentAllocation` records in PropertyOS core database.
5. **Background Jobs Integration**:
   - Connect BullMQ notification processor in PropertyOS to push delivery workers (FCM / Twilio).
