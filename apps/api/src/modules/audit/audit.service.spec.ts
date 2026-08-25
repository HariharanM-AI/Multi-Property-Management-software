import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AuditCategory, UserRole, AuthUser } from '@propertyos/types';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: any;

  const mockOrgId = 'org-11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-22222222-2222-2222-2222-222222222222';
  const mockUser: AuthUser = {
    id: mockUserId,
    email: 'admin@propertyos.internal',
    firstName: 'Admin',
    lastName: 'User',
    organizationId: mockOrgId,
    roles: [UserRole.OWNER],
  };

  const mockAuditRecord = {
    id: 'log-33333333-3333-3333-3333-333333333333',
    organizationId: mockOrgId,
    userId: mockUserId,
    action: 'INVOICE_ISSUED',
    resourceType: 'Invoice',
    resourceId: 'inv-4444',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    metadata: {
      invoiceNumber: 'INV-2026-001',
      totalAmount: 15000,
      password: 'supersecretpassword',
      nested: {
        authToken: 'jwt.token.here',
        safeProperty: 'safeValue',
      },
      list: [{ secretKey: 'key_123', name: 'item' }],
    },
    createdAt: new Date('2026-08-25T12:00:00.000Z'),
    user: {
      id: mockUserId,
      email: 'admin@propertyos.internal',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+919876543210',
      userRoles: [{ role: { name: 'OWNER' } }],
    },
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([mockAuditRecord]),
        findFirst: jest.fn().mockResolvedValue(mockAuditRecord),
        create: jest.fn().mockResolvedValue(mockAuditRecord),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: mockUserId,
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@propertyos.internal',
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('Sensitive Metadata Redaction', () => {
    it('should recursively redact password, token, secret, and key fields in objects and arrays', () => {
      const input = {
        password: 'plain-password',
        userPasswordHash: 'hash-123',
        authToken: 'tok-abc',
        secretKey: 'sec-xyz',
        bankAccountNumber: '98765432100',
        publicNote: 'Clean note',
        nested: {
          sessionToken: 'sess-123',
          normalKey: 'ok',
        },
        items: [
          { password: '123', name: 'A' },
          { token: '456', name: 'B' },
        ],
      };

      const sanitized = service.redactSensitiveMetadata(input);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.userPasswordHash).toBe('[REDACTED]');
      expect(sanitized.authToken).toBe('[REDACTED]');
      expect(sanitized.secretKey).toBe('[REDACTED]');
      expect(sanitized.bankAccountNumber).toBe('[REDACTED]');
      expect(sanitized.publicNote).toBe('Clean note');
      expect(sanitized.nested.sessionToken).toBe('[REDACTED]');
      expect(sanitized.nested.normalKey).toBe('ok');
      expect(sanitized.items[0].password).toBe('[REDACTED]');
      expect(sanitized.items[0].name).toBe('A');
      expect(sanitized.items[1].token).toBe('[REDACTED]');
      expect(sanitized.items[1].name).toBe('B');
    });

    it('should handle primitives and null values safely', () => {
      expect(service.redactSensitiveMetadata(null)).toBeNull();
      expect(service.redactSensitiveMetadata(undefined)).toBeUndefined();
      expect(service.redactSensitiveMetadata('simple string')).toBe('simple string');
      expect(service.redactSensitiveMetadata(42)).toBe(42);
    });
  });

  describe('Spreadsheet Formula Injection Defense (CSV)', () => {
    it('should prepend single quote to cells starting with dangerous characters (=, +, -, @)', () => {
      expect(service.sanitizeCsvCell('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`);
      expect(service.sanitizeCsvCell('+cmd|/C')).toBe(`"'+cmd|/C"`);
      expect(service.sanitizeCsvCell('-2+3*cmd')).toBe(`"'-2+3*cmd"`);
      expect(service.sanitizeCsvCell('@SUM(1+1)')).toBe(`"'@SUM(1+1)"`);
    });

    it('should escape double quotes and format standard text properly per RFC 4180', () => {
      expect(service.sanitizeCsvCell('Normal Text')).toBe('"Normal Text"');
      expect(service.sanitizeCsvCell('Text with "quotes"')).toBe('"Text with ""quotes"""');
      expect(service.sanitizeCsvCell(12345)).toBe('"12345"');
      expect(service.sanitizeCsvCell(null)).toBe('');
    });
  });

  describe('getAuditLogs', () => {
    it('should query logs scoped strictly to organizationId with pagination and redaction', async () => {
      const result = await service.getAuditLogs(mockOrgId, mockUser, {
        page: 1,
        limit: 10,
        sortBy: 'NEWEST',
      });

      expect(prisma.auditLog.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ organizationId: mockOrgId }),
      });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: mockOrgId }),
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockAuditRecord.id);
      expect(result.data[0].metadata?.password).toBe('[REDACTED]');
      expect(result.data[0].metadata?.nested?.authToken).toBe('[REDACTED]');
      expect(result.data[0].actor?.email).toBe('admin@propertyos.internal');
      expect(result.data[0].actor?.role).toBe('OWNER');
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should apply category action filters correctly', async () => {
      await service.getAuditLogs(mockOrgId, mockUser, {
        category: AuditCategory.FINANCE_BILLING,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: mockOrgId,
            action: expect.objectContaining({
              in: expect.arrayContaining(['INVOICE_GENERATED', 'PAYMENT_RECORDED']),
            }),
          }),
        }),
      );
    });

    it('should apply date range and keyword search filters', async () => {
      await service.getAuditLogs(mockOrgId, mockUser, {
        search: 'INV-2026',
        startDate: '2026-08-01',
        endDate: '2026-08-25',
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: mockOrgId,
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
            OR: expect.arrayContaining([
              { action: { contains: 'INV-2026', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('getAuditLogById', () => {
    it('should return sanitized audit log by ID within organization', async () => {
      const log = await service.getAuditLogById(mockOrgId, mockUser, mockAuditRecord.id);

      expect(prisma.auditLog.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockAuditRecord.id,
          organizationId: mockOrgId,
        },
        include: expect.any(Object),
      });

      expect(log.id).toBe(mockAuditRecord.id);
      expect(log.metadata?.password).toBe('[REDACTED]');
      expect(log.actor?.role).toBe('OWNER');
    });

    it('should throw NotFoundException if log not found or belongs to another organization', async () => {
      prisma.auditLog.findFirst.mockResolvedValue(null);

      await expect(
        service.getAuditLogById(mockOrgId, mockUser, 'foreign-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAuditSummary', () => {
    it('should aggregate total, 24h, 7d, security, and financial counts', async () => {
      prisma.auditLog.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(10) // 24h
        .mockResolvedValueOnce(35) // 7d
        .mockResolvedValueOnce(3) // critical security
        .mockResolvedValueOnce(18); // financial

      prisma.auditLog.groupBy
        .mockResolvedValueOnce([{ action: 'INVOICE_ISSUED', _count: { action: 12 } }])
        .mockResolvedValueOnce([{ resourceType: 'Invoice', _count: { resourceType: 15 } }])
        .mockResolvedValueOnce([{ userId: mockUserId, _count: { userId: 25 } }]);

      const summary = await service.getAuditSummary(mockOrgId, mockUser);

      expect(summary.totalLogs).toBe(50);
      expect(summary.eventsLast24h).toBe(10);
      expect(summary.eventsLast7d).toBe(35);
      expect(summary.criticalSecurityEvents).toBe(3);
      expect(summary.financialEvents).toBe(18);
      expect(summary.topActions[0].action).toBe('INVOICE_ISSUED');
      expect(summary.topActors[0].name).toBe('Admin User');
    });
  });

  describe('exportAuditLogs', () => {
    it('should export CSV format with sanitized cells and log AUDIT_LOG_EXPORTED event', async () => {
      const result = await service.exportAuditLogs(
        mockOrgId,
        mockUser,
        { format: 'CSV' },
        '127.0.0.1',
        'JestRunner',
      );

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^audit_logs_.*\.csv$/);
      expect(result.data).toContain('"Log ID","Timestamp (UTC)","Action"');
      expect(result.data).toContain('"INVOICE_ISSUED"');

      // Verify immutable AUDIT_LOG_EXPORTED event written
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: mockOrgId,
            userId: mockUserId,
            action: 'AUDIT_LOG_EXPORTED',
            resourceType: 'AuditLog',
          }),
        }),
      );
    });

    it('should export JSON format with sanitized objects', async () => {
      const result = await service.exportAuditLogs(
        mockOrgId,
        mockUser,
        { format: 'JSON' },
        '127.0.0.1',
        'JestRunner',
      );

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toMatch(/^audit_logs_.*\.json$/);

      const parsed = JSON.parse(result.data);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].action).toBe('INVOICE_ISSUED');
      expect(parsed[0].metadata.password).toBe('[REDACTED]');
      expect(parsed[0].actor.role).toBe('OWNER');
    });
  });

  describe('logEvent (reusable writer)', () => {
    it('should insert audit log into database in append-only fashion', async () => {
      await service.logEvent(
        prisma,
        mockOrgId,
        mockUserId,
        'PROPERTY_CREATED',
        'Property',
        'prop-123',
        { name: 'Skyline PG' },
        '10.0.0.1',
        'TestAgent',
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: mockOrgId,
          userId: mockUserId,
          action: 'PROPERTY_CREATED',
          resourceType: 'Property',
          resourceId: 'prop-123',
          metadata: { name: 'Skyline PG' },
          ipAddress: '10.0.0.1',
          userAgent: 'TestAgent',
        },
      });
    });
  });
});
