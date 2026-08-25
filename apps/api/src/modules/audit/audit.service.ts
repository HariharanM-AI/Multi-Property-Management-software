import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AuditLogDto,
  AuditLogQueryDto,
  AuditSummaryDto,
  AuditExportQueryDto,
  AuditCategory,
  AuditAction,
  AuditTopActor,
  AuditActionCount,
  AuditResourceTypeCount,
  AuthUser,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

const SENSITIVE_KEY_REGEX =
  /password|token|secret|hash|bankaccount|pan|aadhaar|pin|api_?key|secret_?key|access_?key|private_?key|^key$/i;

const CATEGORY_ACTIONS_MAP: Record<AuditCategory, string[]> = {
  [AuditCategory.AUTH_SECURITY]: [
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_CONFIRMED',
    'PASSWORD_CHANGED',
  ],
  [AuditCategory.ORGANIZATION_TEAM]: [
    'ORGANIZATION_CREATED',
    'ORGANIZATION_UPDATED',
    'TEAM_INVITATION_SENT',
    'TEAM_INVITATION_ACCEPTED',
    'TEAM_INVITATION_CANCELLED',
    'TEAM_MEMBER_ROLE_UPDATED',
    'TEAM_MEMBER_REMOVED',
  ],
  [AuditCategory.PROPERTIES_STRUCTURE]: [
    'PROPERTY_CREATED',
    'PROPERTY_UPDATED',
    'PROPERTY_ARCHIVED',
    'PROPERTY_RESTORED',
    'PROPERTY_DELETED',
    'PROPERTY_MEDIA_UPLOADED',
    'PROPERTY_MEDIA_DELETED',
    'FLOOR_CREATED',
    'FLOOR_UPDATED',
    'FLOOR_DELETED',
    'ROOM_CREATED',
    'ROOM_UPDATED',
    'ROOM_DELETED',
    'BED_CREATED',
    'BED_UPDATED',
    'BED_DELETED',
    'RENTAL_UNIT_CREATED',
    'RENTAL_UNIT_UPDATED',
    'RENTAL_UNIT_DELETED',
  ],
  [AuditCategory.TENANTS_KYC]: [
    'TENANT_CREATED',
    'TENANT_UPDATED',
    'TENANT_DELETED',
    'KYC_DOCUMENT_UPLOADED',
    'KYC_DOCUMENT_VERIFIED',
    'KYC_DOCUMENT_DELETED',
  ],
  [AuditCategory.LEASES_STAYS]: [
    'LEASE_CREATED',
    'LEASE_UPDATED',
    'LEASE_TERMINATED',
    'CHECKIN_RECORD_CREATED',
    'CHECKIN_COMPLETED',
    'CHECKOUT_INITIATED',
    'CHECKOUT_INSPECTED',
    'CHECKOUT_SETTLED',
    'CHECKOUT_COMPLETED',
    'AGREEMENT_TEMPLATE_CREATED',
    'AGREEMENT_TEMPLATE_UPDATED',
    'AGREEMENT_GENERATED',
    'AGREEMENT_SIGNED',
    'AGREEMENT_VOIDED',
  ],
  [AuditCategory.FINANCE_BILLING]: [
    'INVOICE_GENERATED',
    'INVOICE_ISSUED',
    'INVOICE_VOIDED',
    'PAYMENT_RECORDED',
    'PAYMENT_ALLOCATED',
    'PAYMENT_REVERSED',
    'SECURITY_DEPOSIT_COLLECTED',
    'SECURITY_DEPOSIT_REFUNDED',
    'SECURITY_DEPOSIT_DEDUCTED',
    'LEDGER_ENTRY_RECORDED',
    'EXPENSE_CREATED',
    'EXPENSE_UPDATED',
    'EXPENSE_DELETED',
    'EXPENSE_RECEIPT_UPLOADED',
  ],
  [AuditCategory.FACILITY_OPERATIONS]: [
    'ELECTRICITY_METER_CREATED',
    'ELECTRICITY_READING_RECORDED',
    'ELECTRICITY_RATE_CREATED',
    'ELECTRICITY_INVOICE_GENERATED',
    'MEAL_PLAN_CREATED',
    'MEAL_SUBSCRIPTION_CREATED',
    'MEAL_RECORD_LOGGED',
    'MEAL_CHARGE_GENERATED',
    'TICKET_CREATED',
    'TICKET_ASSIGNED',
    'TICKET_STATUS_CHANGED',
    'TICKET_COMMENT_ADDED',
    'TICKET_ATTACHMENT_ADDED',
    'VENDOR_CREATED',
    'VENDOR_UPDATED',
    'STAFF_MEMBER_CREATED',
    'STAFF_MEMBER_UPDATED',
    'STAFF_MEMBER_DEACTIVATED',
    'STAFF_ATTENDANCE_MARKED',
    'VISITOR_REGISTERED',
    'VISITOR_CHECKED_IN',
    'VISITOR_CHECKED_OUT',
    'VISITOR_APPROVED',
    'VISITOR_REJECTED',
    'VISITOR_DELETED',
    'INVENTORY_CREATED',
    'INVENTORY_UPDATED',
    'INVENTORY_ASSIGNED',
    'INVENTORY_UNASSIGNED',
    'INVENTORY_CONDITION_CHANGED',
    'INVENTORY_STATUS_CHANGED',
    'INVENTORY_DELETED',
    'SERVICE_REQUEST_CREATED',
    'SERVICE_REQUEST_UPDATED',
    'SERVICE_REQUEST_ASSIGNED',
    'SERVICE_REQUEST_STATUS_CHANGED',
    'SERVICE_REQUEST_CANCELLED',
    'SERVICE_REQUEST_DELETED',
  ],
  [AuditCategory.COMMUNITY_ENGAGEMENT]: [
    'COMMUNITY_POST_CREATED',
    'COMMUNITY_POST_UPDATED',
    'COMMUNITY_POST_PINNED',
    'COMMUNITY_POST_UNPINNED',
    'COMMUNITY_POST_DELETED',
    'COMMUNITY_COMMENT_CREATED',
    'COMMUNITY_COMMENT_DELETED',
    'MARKETPLACE_LISTING_CREATED',
    'MARKETPLACE_LISTING_UPDATED',
    'MARKETPLACE_LISTING_STATUS_CHANGED',
    'MARKETPLACE_LISTING_DELETED',
  ],
  [AuditCategory.AUDIT_COMPLIANCE]: [
    'REPORT_EXPORTED',
    'AUDIT_LOG_EXPORTED',
  ],
};

const CRITICAL_SECURITY_ACTIONS = [
  'LOGIN_FAILED',
  'PASSWORD_RESET_CONFIRMED',
  'PASSWORD_CHANGED',
  'TEAM_MEMBER_REMOVED',
  'PROPERTY_DELETED',
  'TENANT_DELETED',
  'STAFF_MEMBER_DEACTIVATED',
];

const FINANCIAL_ACTIONS = [
  'INVOICE_GENERATED',
  'INVOICE_ISSUED',
  'INVOICE_VOIDED',
  'PAYMENT_RECORDED',
  'PAYMENT_ALLOCATED',
  'PAYMENT_REVERSED',
  'SECURITY_DEPOSIT_COLLECTED',
  'SECURITY_DEPOSIT_REFUNDED',
  'SECURITY_DEPOSIT_DEDUCTED',
  'LEDGER_ENTRY_RECORDED',
  'EXPENSE_CREATED',
  'EXPENSE_UPDATED',
  'EXPENSE_DELETED',
];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recursively sanitizes/redacts sensitive values from metadata
   */
  public redactSensitiveMetadata(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.redactSensitiveMetadata(item));
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.redactSensitiveMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Neutralizes formula injection on CSV values
   */
  public sanitizeCsvCell(value: any): string {
    if (value === null || value === undefined) return '';
    let stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // If cell starts with dangerous formula execution characters, prepend with single quote
    if (/^[=+\-@\t\r]/.test(stringVal)) {
      stringVal = `'${stringVal}`;
    }

    // RFC 4180 escaping for double quotes
    return `"${stringVal.replace(/"/g, '""')}"`;
  }

  /**
   * Append-only event writer reusable across modules
   */
  public async logEvent(
    prismaOrTx: Prisma.TransactionClient | PrismaService,
    organizationId: string,
    userId: string | null,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any> | null,
    ipAddress?: string | null,
    userAgent?: string | null,
  ) {
    try {
      return await prismaOrTx.auditLog.create({
        data: {
          organizationId,
          userId,
          action,
          resourceType,
          resourceId,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to write audit log for action ${action}: ${err.message}`, err.stack);
      // Audit writing must be fail-safe to not break operational transactions
    }
  }

  /**
   * Query & filter audit logs with pagination and multi-tenant scoping
   */
  public async getAuditLogs(
    organizationId: string,
    user: AuthUser,
    query: AuditLogQueryDto,
  ): Promise<{ data: AuditLogDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      organizationId,
    };

    if (query.action) {
      where.action = { equals: query.action, mode: 'insensitive' };
    }

    if (query.category && CATEGORY_ACTIONS_MAP[query.category]) {
      const actions = CATEGORY_ACTIONS_MAP[query.category];
      where.action = { in: actions };
    }

    if (query.resourceType) {
      where.resourceType = { equals: query.resourceType, mode: 'insensitive' };
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        if (query.endDate.length === 10) {
          endDate.setUTCHours(23, 59, 59, 999);
        }
        where.createdAt.lte = endDate;
      }
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resourceType: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { userAgent: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {
      createdAt: query.sortBy === 'OLDEST' ? 'asc' : 'desc',
    };

    const [total, records] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              userRoles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const data: AuditLogDto[] = records.map((record) => {
      const primaryRole =
        record.user?.userRoles && record.user.userRoles.length > 0
          ? record.user.userRoles[0].role.name
          : null;

      return {
        id: record.id,
        organizationId: record.organizationId,
        userId: record.userId,
        action: record.action,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
        metadata: this.redactSensitiveMetadata(record.metadata),
        createdAt: record.createdAt.toISOString(),
        actor: record.user
          ? {
              id: record.user.id,
              email: record.user.email,
              firstName: record.user.firstName,
              lastName: record.user.lastName,
              phone: record.user.phone,
              role: primaryRole,
            }
          : null,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieve single audit log by ID with multi-tenant protection and redacted metadata
   */
  public async getAuditLogById(
    organizationId: string,
    user: AuthUser,
    id: string,
  ): Promise<AuditLogDto> {
    const record = await this.prisma.auditLog.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Audit log record not found');
    }

    const primaryRole =
      record.user?.userRoles && record.user.userRoles.length > 0
        ? record.user.userRoles[0].role.name
        : null;

    return {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      metadata: this.redactSensitiveMetadata(record.metadata),
      createdAt: record.createdAt.toISOString(),
      actor: record.user
        ? {
            id: record.user.id,
            email: record.user.email,
            firstName: record.user.firstName,
            lastName: record.user.lastName,
            phone: record.user.phone,
            role: primaryRole,
          }
        : null,
    };
  }

  /**
   * Aggregate summary statistics & KPIs for audit dashboard
   */
  public async getAuditSummary(
    organizationId: string,
    user: AuthUser,
    query?: { startDate?: string; endDate?: string },
  ): Promise<AuditSummaryDto> {
    const now = new Date();
    const last24hDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7dDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const baseWhere: Prisma.AuditLogWhereInput = {
      organizationId,
    };

    if (query?.startDate || query?.endDate) {
      baseWhere.createdAt = {};
      if (query.startDate) baseWhere.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        if (query.endDate.length === 10) endDate.setUTCHours(23, 59, 59, 999);
        baseWhere.createdAt.lte = endDate;
      }
    }

    const [
      totalLogs,
      eventsLast24h,
      eventsLast7d,
      criticalSecurityEvents,
      financialEvents,
      actionGroups,
      resourceGroups,
      userGroups,
    ] = await Promise.all([
      this.prisma.auditLog.count({ where: baseWhere }),
      this.prisma.auditLog.count({
        where: {
          organizationId,
          createdAt: { gte: last24hDate },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          organizationId,
          createdAt: { gte: last7dDate },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          ...baseWhere,
          action: { in: CRITICAL_SECURITY_ACTIONS },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          ...baseWhere,
          action: { in: FINANCIAL_ACTIONS },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: baseWhere,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 8,
      }),
      this.prisma.auditLog.groupBy({
        by: ['resourceType'],
        where: baseWhere,
        _count: { resourceType: true },
        orderBy: { _count: { resourceType: 'desc' } },
        take: 8,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          ...baseWhere,
          userId: { not: null },
        },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 5,
      }),
    ]);

    // Hydrate top actors
    const userIds = userGroups.map((g) => g.userId).filter((id): id is string => Boolean(id));
    const userProfiles = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];

    const userProfileMap = new Map(userProfiles.map((u) => [u.id, u]));

    const topActors: AuditTopActor[] = userGroups.map((group) => {
      const u = group.userId ? userProfileMap.get(group.userId) : null;
      return {
        userId: group.userId || '',
        name: u ? `${u.firstName} ${u.lastName}` : 'Unknown User',
        email: u ? u.email : '',
        eventCount: group._count.userId,
      };
    });

    const topActions: AuditActionCount[] = actionGroups.map((g) => ({
      action: g.action,
      count: g._count.action,
    }));

    const resourceBreakdown: AuditResourceTypeCount[] = resourceGroups.map((g) => ({
      resourceType: g.resourceType,
      count: g._count.resourceType,
    }));

    return {
      totalLogs,
      eventsLast24h,
      eventsLast7d,
      uniqueActors: userGroups.length,
      criticalSecurityEvents,
      financialEvents,
      topActions,
      resourceBreakdown,
      topActors,
    };
  }

  /**
   * Export audit logs in CSV or JSON format with formula injection protection and audit logging
   */
  public async exportAuditLogs(
    organizationId: string,
    user: AuthUser,
    query: AuditExportQueryDto,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<{ data: string; filename: string; contentType: string }> {
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
    };

    if (query.action) {
      where.action = { equals: query.action, mode: 'insensitive' };
    }

    if (query.category && CATEGORY_ACTIONS_MAP[query.category]) {
      where.action = { in: CATEGORY_ACTIONS_MAP[query.category] };
    }

    if (query.resourceType) {
      where.resourceType = { equals: query.resourceType, mode: 'insensitive' };
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        if (query.endDate.length === 10) endDate.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resourceType: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { userAgent: { contains: search, mode: 'insensitive' } },
      ];
    }

    const records = await this.prisma.auditLog.findMany({
      where,
      take: 5000,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const format = query.format === 'JSON' ? 'JSON' : 'CSV';

    // Log immutable AUDIT_LOG_EXPORTED audit entry
    await this.logEvent(
      this.prisma,
      organizationId,
      user.id,
      'AUDIT_LOG_EXPORTED',
      'AuditLog',
      `export-${timestampStr}`,
      {
        format,
        exportedCount: records.length,
        filterAction: query.action || null,
        filterCategory: query.category || null,
        filterResourceType: query.resourceType || null,
        startDate: query.startDate || null,
        endDate: query.endDate || null,
      },
      ipAddress,
      userAgent,
    );

    if (format === 'JSON') {
      const sanitizedLogs = records.map((r) => {
        const primaryRole =
          r.user?.userRoles && r.user.userRoles.length > 0
            ? r.user.userRoles[0].role.name
            : null;

        return {
          id: r.id,
          timestamp: r.createdAt.toISOString(),
          action: r.action,
          resourceType: r.resourceType,
          resourceId: r.resourceId,
          actor: r.user
            ? {
                id: r.user.id,
                name: `${r.user.firstName} ${r.user.lastName}`,
                email: r.user.email,
                role: primaryRole,
              }
            : null,
          ipAddress: r.ipAddress,
          userAgent: r.userAgent,
          metadata: this.redactSensitiveMetadata(r.metadata),
        };
      });

      return {
        data: JSON.stringify(sanitizedLogs, null, 2),
        filename: `audit_logs_${timestampStr}.json`,
        contentType: 'application/json',
      };
    }

    // CSV format
    const headers = [
      'Log ID',
      'Timestamp (UTC)',
      'Action',
      'Resource Type',
      'Resource ID',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'IP Address',
      'User Agent',
      'Sanitized Metadata',
    ];

    const rows: string[] = [headers.map((h) => this.sanitizeCsvCell(h)).join(',')];

    for (const record of records) {
      const sanitizedMetadata = this.redactSensitiveMetadata(record.metadata);
      const actorName = record.user ? `${record.user.firstName} ${record.user.lastName}` : 'System';
      const actorEmail = record.user ? record.user.email : 'system@propertyos.internal';
      const actorRole =
        record.user?.userRoles && record.user.userRoles.length > 0
          ? record.user.userRoles[0].role.name
          : 'SYSTEM';

      const row = [
        this.sanitizeCsvCell(record.id),
        this.sanitizeCsvCell(record.createdAt.toISOString()),
        this.sanitizeCsvCell(record.action),
        this.sanitizeCsvCell(record.resourceType),
        this.sanitizeCsvCell(record.resourceId),
        this.sanitizeCsvCell(actorName),
        this.sanitizeCsvCell(actorEmail),
        this.sanitizeCsvCell(actorRole),
        this.sanitizeCsvCell(record.ipAddress || ''),
        this.sanitizeCsvCell(record.userAgent || ''),
        this.sanitizeCsvCell(sanitizedMetadata ? JSON.stringify(sanitizedMetadata) : ''),
      ];

      rows.push(row.join(','));
    }

    return {
      data: rows.join('\r\n'),
      filename: `audit_logs_${timestampStr}.csv`,
      contentType: 'text/csv',
    };
  }
}
