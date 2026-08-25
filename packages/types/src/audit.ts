// ==============================================================================
// PropertyOS Audit Trail & Event Logging Types (CORE-028)
// ==============================================================================

export enum AuditCategory {
  AUTH_SECURITY = 'AUTH_SECURITY',
  ORGANIZATION_TEAM = 'ORGANIZATION_TEAM',
  PROPERTIES_STRUCTURE = 'PROPERTIES_STRUCTURE',
  TENANTS_KYC = 'TENANTS_KYC',
  LEASES_STAYS = 'LEASES_STAYS',
  FINANCE_BILLING = 'FINANCE_BILLING',
  FACILITY_OPERATIONS = 'FACILITY_OPERATIONS',
  COMMUNITY_ENGAGEMENT = 'COMMUNITY_ENGAGEMENT',
  AUDIT_COMPLIANCE = 'AUDIT_COMPLIANCE',
}

export type AuditAction =
  // Auth & Security
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_CONFIRMED'
  | 'PASSWORD_CHANGED'
  // Organization & Team
  | 'ORGANIZATION_CREATED'
  | 'ORGANIZATION_UPDATED'
  | 'TEAM_INVITATION_SENT'
  | 'TEAM_INVITATION_ACCEPTED'
  | 'TEAM_INVITATION_CANCELLED'
  | 'TEAM_MEMBER_ROLE_UPDATED'
  | 'TEAM_MEMBER_REMOVED'
  // Property & Structure
  | 'PROPERTY_CREATED'
  | 'PROPERTY_UPDATED'
  | 'PROPERTY_ARCHIVED'
  | 'PROPERTY_RESTORED'
  | 'PROPERTY_DELETED'
  | 'PROPERTY_MEDIA_UPLOADED'
  | 'PROPERTY_MEDIA_DELETED'
  | 'FLOOR_CREATED'
  | 'FLOOR_UPDATED'
  | 'FLOOR_DELETED'
  | 'ROOM_CREATED'
  | 'ROOM_UPDATED'
  | 'ROOM_DELETED'
  | 'BED_CREATED'
  | 'BED_UPDATED'
  | 'BED_DELETED'
  | 'RENTAL_UNIT_CREATED'
  | 'RENTAL_UNIT_UPDATED'
  | 'RENTAL_UNIT_DELETED'
  // Tenants & KYC
  | 'TENANT_CREATED'
  | 'TENANT_UPDATED'
  | 'TENANT_DELETED'
  | 'KYC_DOCUMENT_UPLOADED'
  | 'KYC_DOCUMENT_VERIFIED'
  | 'KYC_DOCUMENT_DELETED'
  // Leases, Check-In & Check-Out
  | 'LEASE_CREATED'
  | 'LEASE_UPDATED'
  | 'LEASE_TERMINATED'
  | 'CHECKIN_RECORD_CREATED'
  | 'CHECKIN_COMPLETED'
  | 'CHECKOUT_INITIATED'
  | 'CHECKOUT_INSPECTED'
  | 'CHECKOUT_SETTLED'
  | 'CHECKOUT_COMPLETED'
  // Agreements
  | 'AGREEMENT_TEMPLATE_CREATED'
  | 'AGREEMENT_TEMPLATE_UPDATED'
  | 'AGREEMENT_GENERATED'
  | 'AGREEMENT_SIGNED'
  | 'AGREEMENT_VOIDED'
  // Financials & Invoices
  | 'INVOICE_GENERATED'
  | 'INVOICE_ISSUED'
  | 'INVOICE_VOIDED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_ALLOCATED'
  | 'PAYMENT_REVERSED'
  | 'SECURITY_DEPOSIT_COLLECTED'
  | 'SECURITY_DEPOSIT_REFUNDED'
  | 'SECURITY_DEPOSIT_DEDUCTED'
  | 'LEDGER_ENTRY_RECORDED'
  // Utilities & Meals
  | 'ELECTRICITY_METER_CREATED'
  | 'ELECTRICITY_READING_RECORDED'
  | 'ELECTRICITY_RATE_CREATED'
  | 'ELECTRICITY_INVOICE_GENERATED'
  | 'MEAL_PLAN_CREATED'
  | 'MEAL_SUBSCRIPTION_CREATED'
  | 'MEAL_RECORD_LOGGED'
  | 'MEAL_CHARGE_GENERATED'
  // Maintenance & Facility
  | 'TICKET_CREATED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_COMMENT_ADDED'
  | 'TICKET_ATTACHMENT_ADDED'
  | 'VENDOR_CREATED'
  | 'VENDOR_UPDATED'
  // Staff & Visitors
  | 'STAFF_MEMBER_CREATED'
  | 'STAFF_MEMBER_UPDATED'
  | 'STAFF_MEMBER_DEACTIVATED'
  | 'STAFF_ATTENDANCE_MARKED'
  | 'VISITOR_REGISTERED'
  | 'VISITOR_CHECKED_IN'
  | 'VISITOR_CHECKED_OUT'
  | 'VISITOR_APPROVED'
  | 'VISITOR_REJECTED'
  | 'VISITOR_DELETED'
  // Inventory & Expenses
  | 'INVENTORY_CREATED'
  | 'INVENTORY_UPDATED'
  | 'INVENTORY_ASSIGNED'
  | 'INVENTORY_UNASSIGNED'
  | 'INVENTORY_CONDITION_CHANGED'
  | 'INVENTORY_STATUS_CHANGED'
  | 'INVENTORY_DELETED'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED'
  | 'EXPENSE_RECEIPT_UPLOADED'
  // Reports
  | 'REPORT_EXPORTED'
  // Community & Marketplace
  | 'COMMUNITY_POST_CREATED'
  | 'COMMUNITY_POST_UPDATED'
  | 'COMMUNITY_POST_PINNED'
  | 'COMMUNITY_POST_UNPINNED'
  | 'COMMUNITY_POST_DELETED'
  | 'COMMUNITY_COMMENT_CREATED'
  | 'COMMUNITY_COMMENT_DELETED'
  | 'MARKETPLACE_LISTING_CREATED'
  | 'MARKETPLACE_LISTING_UPDATED'
  | 'MARKETPLACE_LISTING_STATUS_CHANGED'
  | 'MARKETPLACE_LISTING_DELETED'
  // Local Services
  | 'SERVICE_REQUEST_CREATED'
  | 'SERVICE_REQUEST_UPDATED'
  | 'SERVICE_REQUEST_ASSIGNED'
  | 'SERVICE_REQUEST_STATUS_CHANGED'
  | 'SERVICE_REQUEST_CANCELLED'
  | 'SERVICE_REQUEST_DELETED'
  // Audit Trail
  | 'AUDIT_LOG_EXPORTED'
  | string;

export interface AuditActorDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role?: string | null;
}

export interface AuditLogDto {
  id: string;
  organizationId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  actor?: AuditActorDto | null;
}

export interface AuditLogQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  category?: AuditCategory;
  sortBy?: 'NEWEST' | 'OLDEST';
}

export interface AuditExportQueryDto {
  format?: 'CSV' | 'JSON';
  search?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  category?: AuditCategory;
}

export interface AuditCategoryCount {
  category: AuditCategory;
  count: number;
}

export interface AuditActionCount {
  action: string;
  count: number;
}

export interface AuditResourceTypeCount {
  resourceType: string;
  count: number;
}

export interface AuditTopActor {
  userId: string;
  name: string;
  email: string;
  eventCount: number;
}

export interface AuditSummaryDto {
  totalLogs: number;
  eventsLast24h: number;
  eventsLast7d: number;
  uniqueActors: number;
  criticalSecurityEvents: number;
  financialEvents: number;
  topActions: AuditActionCount[];
  resourceBreakdown: AuditResourceTypeCount[];
  topActors: AuditTopActor[];
}
