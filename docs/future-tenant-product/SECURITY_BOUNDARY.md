# Future Tenant Product — Security Boundary & Authorization

## Security Principles

1. **Strict Active Stay Validation**:
   - Every tenant request must validate that `tenantId` is associated with an active stay record (`TenantStayHistory.status = 'ACTIVE'`).
   - Evicted, moved-out, or prospect tenants are automatically blocked from accessing property services.
2. **Zero Financial Scope Escalation**:
   - Invoices, payments, and deposits are strictly queried by `where: { tenantId: user.tenantId }`.
   - Tenants can never query building-wide receivables, expense receipts, staff payroll, or owner P&L.
3. **No Internal System Exposure**:
   - Zero access to `AuditLog`, `JobExecution`, `ScheduledJobConfig`, `StaffMember`, or internal sequences.
