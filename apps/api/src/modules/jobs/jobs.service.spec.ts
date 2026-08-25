import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { JobsWorkerService } from './jobs-worker.service';
import { JobsRedisProvider } from './jobs-redis.provider';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import {
  JobType,
  JobExecutionStatus,
  JobQueueName,
  UserRole,
  Permission,
  AuthUser,
} from '@propertyos/types';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation((name, opts) => ({
      name,
      opts,
      add: jest.fn().mockResolvedValue({ id: 'mock-bull-job-1' }),
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 5, failed: 0, delayed: 0 }),
      isPaused: jest.fn().mockResolvedValue(false),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      clean: jest.fn().mockResolvedValue(['job-1', 'job-2']),
      close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation((name, processor, opts) => ({
      name,
      processor,
      opts,
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('JobsService & JobsWorkerService Unit Tests', () => {
  let jobsService: JobsService;
  let workerService: JobsWorkerService;
  let prisma: any;
  let auditService: any;
  let notificationsService: any;
  let redisProvider: any;

  const mockUser: AuthUser = {
    id: 'usr-11111111-1111-1111-1111-111111111111',
    organizationId: 'org-11111111-1111-1111-1111-111111111111',
    email: 'owner@propertyos.internal',
    firstName: 'Owner',
    lastName: 'User',
    roles: [UserRole.OWNER],
  };

  const mockOrgId = mockUser.organizationId;

  const mockPrismaService: any = {
    organization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    property: {
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    jobExecution: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    scheduledJobConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    billingSchedule: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    maintenanceTicket: {
      findMany: jest.fn(),
    },
    maintenanceComment: {
      create: jest.fn(),
    },
    lease: {
      findMany: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) => cb(mockPrismaService)),
  };

  const mockAuditService = {
    logEvent: jest.fn().mockResolvedValue({ id: 'audit-123' }),
    redactSensitiveMetadata: jest.fn((data) => {
      if (!data || typeof data !== 'object') return data;
      const copy = { ...data };
      delete copy.password;
      delete copy.token;
      delete copy.secret;
      return copy;
    }),
  };

  const mockNotificationsService = {
    createNotification: jest.fn().mockResolvedValue({ id: 'notif-123' }),
  };

  const mockRedisProvider = {
    getRedisOptions: jest.fn().mockReturnValue({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null }),
    getClient: jest.fn().mockReturnValue({ ping: jest.fn().mockResolvedValue('PONG') }),
    isHealthy: jest.fn().mockResolvedValue(true),
    onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        JobsWorkerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: JobsRedisProvider, useValue: mockRedisProvider },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'REDIS_URL') return 'redis://localhost:6379';
              return null;
            }),
          },
        },
      ],
    }).compile();

    jobsService = module.get<JobsService>(JobsService);
    workerService = module.get<JobsWorkerService>(JobsWorkerService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    redisProvider = module.get<JobsRedisProvider>(JobsRedisProvider);
  });

  // ----------------------------------------------------------------------------
  // SUITE 1: Initialization & Redis Config
  // ----------------------------------------------------------------------------
  describe('1. Initialization & Redis Config', () => {
    it('should initialize queues without throwing errors', async () => {
      await expect(jobsService.onModuleInit()).resolves.not.toThrow();
    });

    it('should report Redis engine health as true when connected', async () => {
      await jobsService.onModuleInit();
      const stats = await jobsService.getQueueStats();
      expect(stats.engine).toBe('BullMQ + Redis');
      expect(stats.redisConnected).toBe(true);
      expect(stats.queues).toBeDefined();
      expect(stats.queues.jobs).toBeDefined();
      expect(stats.queues.notifications).toBeDefined();
      expect(stats.queues.dlq).toBeDefined();
    });
  });

  // ----------------------------------------------------------------------------
  // SUITE 2: Job Triggering & Persistence
  // ----------------------------------------------------------------------------
  describe('2. Manual Job Triggering & Execution Lifecycle', () => {
    beforeEach(async () => {
      await jobsService.onModuleInit();
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        jobsService.triggerJob('invalid-org', mockUser, {
          jobType: JobType.INVOICE_GENERATION,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if specified property does not belong to organization', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: mockOrgId });
      prisma.property.findFirst.mockResolvedValue(null);

      await expect(
        jobsService.triggerJob(mockOrgId, mockUser, {
          jobType: JobType.INVOICE_GENERATION,
          propertyId: '11111111-1111-1111-1111-111111111111',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a durable JobExecution record, enqueue in BullMQ, and log audit event', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: mockOrgId });
      const mockCreatedExecution = {
        id: 'exec-123',
        organizationId: mockOrgId,
        jobType: JobType.INVOICE_GENERATION,
        queueName: 'propertyos:jobs',
        status: JobExecutionStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        triggeredBy: null,
      };

      prisma.jobExecution.create.mockResolvedValue(mockCreatedExecution);
      prisma.jobExecution.update.mockResolvedValue({
        ...mockCreatedExecution,
        bullJobId: 'job_exec-123',
      });

      const result = await jobsService.triggerJob(mockOrgId, mockUser, {
        jobType: JobType.INVOICE_GENERATION,
        parameters: { forceRun: true, password: 'secretpassword' },
      });

      expect(prisma.jobExecution.create).toHaveBeenCalled();
      expect(auditService.redactSensitiveMetadata).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalledWith(
        prisma,
        mockOrgId,
        mockUser.id,
        'JOB_MANUALLY_TRIGGERED',
        'JOB_EXECUTION',
        'exec-123',
        expect.any(Object),
      );
      expect(result.id).toBe('exec-123');
      expect(result.jobType).toBe(JobType.INVOICE_GENERATION);
    });
  });

  // ----------------------------------------------------------------------------
  // SUITE 3: Invoice Generation Processor & Idempotency
  // ----------------------------------------------------------------------------
  describe('3. Invoice Generation Processor & Idempotency', () => {
    it('should process due billing schedules and create itemized invoices with notifications', async () => {
      const targetDate = new Date('2026-09-01T00:00:00Z');
      const mockSchedule = {
        id: 'sched-1',
        organizationId: mockOrgId,
        tenantId: 'tenant-1',
        chargeId: 'charge-1',
        nextBillingDate: targetDate,
        amount: new Prisma.Decimal('5000.00'),
        frequency: 'MONTHLY',
        active: true,
        tenant: {
          id: 'tenant-1',
          email: 'tenant@test.com',
        },
        charge: {
          id: 'charge-1',
          name: 'Monthly Rent',
          chargeType: 'RENT',
        },
      };

      prisma.billingSchedule.findMany.mockResolvedValue([mockSchedule]);
      prisma.invoice.findFirst.mockResolvedValue(null); // No previous invoice in period
      prisma.user.findFirst.mockResolvedValue({ id: 'usr-tenant' });
      prisma.invoice.create.mockResolvedValue({
        id: 'inv-123',
        invoiceNumber: 'INV-2026-09-123456',
      });

      const res = await workerService.processInvoiceGeneration({
        organizationId: mockOrgId,
        targetDate: targetDate.toISOString(),
      });

      expect(res.generatedInvoicesCount).toBe(1);
      expect(res.schedulesProcessedCount).toBe(1);
      expect(res.totalAmountInvoiced).toBe(5000);
      expect(prisma.billingSchedule.update).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('should skip schedule if invoice for target period already exists (idempotency)', async () => {
      const targetDate = new Date('2026-09-01T00:00:00Z');
      const mockSchedule = {
        id: 'sched-1',
        organizationId: mockOrgId,
        tenantId: 'tenant-1',
        chargeId: 'charge-1',
        nextBillingDate: targetDate,
        amount: new Prisma.Decimal('5000.00'),
        frequency: 'MONTHLY',
        active: true,
        tenant: { email: 'tenant@test.com' },
        charge: { name: 'Rent', chargeType: 'RENT' },
      };

      prisma.billingSchedule.findMany.mockResolvedValue([mockSchedule]);
      // Invoice already exists for this period!
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-existing' });

      const res = await workerService.processInvoiceGeneration({
        organizationId: mockOrgId,
        targetDate: targetDate.toISOString(),
        forceRun: false,
      });

      expect(res.generatedInvoicesCount).toBe(0);
      expect(res.skippedScheduleIds).toContain('sched-1');
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------------------
  // SUITE 4: Payment Reminders Processor & Deduplication
  // ----------------------------------------------------------------------------
  describe('4. Payment Reminders Processor & Deduplication', () => {
    it('should evaluate unpaid overdue/due-soon invoices and send reminder notifications', async () => {
      const overdueInvoice = {
        id: 'inv-overdue',
        organizationId: mockOrgId,
        invoiceNumber: 'INV-001',
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        outstandingAmount: new Prisma.Decimal('4500.00'),
        tenant: { email: 'tenant@test.com' },
      };

      prisma.invoice.findMany.mockResolvedValue([overdueInvoice]);
      prisma.user.findFirst.mockResolvedValue({ id: 'usr-t1' });
      prisma.notification.findFirst.mockResolvedValue(null); // Not previously reminded in 24h

      const res = await workerService.processPaymentReminders({
        organizationId: mockOrgId,
      });

      expect(res.invoicesEvaluatedCount).toBe(1);
      expect(res.overdueRemindersSent).toBe(1);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'usr-t1',
            type: 'PAYMENT_OVERDUE',
          }),
        }),
      );
    });

    it('should deduplicate reminders within 24h window', async () => {
      const overdueInvoice = {
        id: 'inv-overdue',
        organizationId: mockOrgId,
        invoiceNumber: 'INV-001',
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        outstandingAmount: new Prisma.Decimal('4500.00'),
        tenant: { email: 'tenant@test.com' },
      };

      prisma.invoice.findMany.mockResolvedValue([overdueInvoice]);
      prisma.user.findFirst.mockResolvedValue({ id: 'usr-t1' });
      prisma.notification.findFirst.mockResolvedValue({ id: 'notif-existing-today' }); // Already sent today!

      const res = await workerService.processPaymentReminders({
        organizationId: mockOrgId,
      });

      expect(res.overdueRemindersSent).toBe(0);
      expect(res.deduplicatedCount).toBe(1);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------------------
  // SUITE 5: Maintenance Escalation Processor
  // ----------------------------------------------------------------------------
  describe('5. Maintenance Escalation Processor', () => {
    it('should escalate urgent unresolved tickets older than threshold and notify staff/managers', async () => {
      const oldUrgentTicket = {
        id: 'ticket-1',
        ticketNumber: 'TCK-001',
        organizationId: mockOrgId,
        title: 'Water Pipe Burst',
        priority: 'URGENT',
        status: 'OPEN',
        propertyId: 'prop-1',
        createdById: 'usr-creator',
        assignedToId: 'usr-staff',
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours old (> 24h threshold)
        comments: [],
      };

      prisma.maintenanceTicket.findMany.mockResolvedValue([oldUrgentTicket]);
      prisma.user.findMany.mockResolvedValue([{ id: 'usr-owner' }]); // Managers

      const res = await workerService.processMaintenanceEscalation({
        organizationId: mockOrgId,
        urgentThresholdHours: 24,
      });

      expect(res.ticketsEvaluatedCount).toBe(1);
      expect(res.ticketsEscalatedCount).toBe(1);
      expect(res.escalatedTicketIds).toContain('ticket-1');
      expect(prisma.maintenanceComment.create).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------------------
  // SUITE 6: Agreement Expiry Processor
  // ----------------------------------------------------------------------------
  describe('6. Agreement Expiry Processor', () => {
    it('should send notice to tenants with leases expiring in matching window (30/15/7 days)', async () => {
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const expiringLease = {
        id: 'lease-1',
        endDate: expiryDate,
        status: 'ACTIVE',
        tenant: { id: 'tenant-1', email: 'tenant@test.com' },
        rentalUnit: {
          unitNumber: '101',
          property: { id: 'prop-1', name: 'Tower A', organizationId: mockOrgId },
        },
      };

      prisma.lease.findMany.mockResolvedValue([expiringLease]);
      prisma.user.findFirst.mockResolvedValue({ id: 'usr-tenant' });
      prisma.notification.findFirst.mockResolvedValue(null);

      const res = await workerService.processAgreementExpiry({
        organizationId: mockOrgId,
        reminderWindowsDays: [30, 15, 7],
      });

      expect(res.agreementsEvaluatedCount).toBe(1);
      expect(res.expiringRemindersSentCount).toBe(1);
      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------------------
  // SUITE 7: System Cleanup Processor
  // ----------------------------------------------------------------------------
  describe('7. System Cleanup Processor', () => {
    it('should delete completed job execution logs older than retention period and expired sessions', async () => {
      prisma.jobExecution.deleteMany.mockResolvedValue({ count: 15 });
      prisma.session.deleteMany.mockResolvedValue({ count: 8 });

      const res = await workerService.processSystemCleanup({
        organizationId: mockOrgId,
        retentionDays: 30,
        cleanQueues: false,
      });

      expect(res.cleanedExecutionRecordsCount).toBe(15);
      expect(res.cleanedSessionsCount).toBe(8);
      expect(prisma.jobExecution.deleteMany).toHaveBeenCalled();
      expect(prisma.session.deleteMany).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------------------
  // SUITE 8: Queue Controls & Retries
  // ----------------------------------------------------------------------------
  describe('8. Queue Controls (Pause, Resume, Clean, Retry)', () => {
    beforeEach(async () => {
      await jobsService.onModuleInit();
    });

    it('should pause and resume queue successfully with audit logging', async () => {
      const pauseRes = await jobsService.pauseQueue(mockOrgId, mockUser, JobQueueName.JOBS);
      expect(pauseRes.success).toBe(true);
      expect(pauseRes.message).toContain('paused');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        prisma,
        mockOrgId,
        mockUser.id,
        'JOB_QUEUE_PAUSED',
        'JOB_QUEUE',
        JobQueueName.JOBS,
        expect.any(Object),
      );

      const resumeRes = await jobsService.resumeQueue(mockOrgId, mockUser, JobQueueName.JOBS);
      expect(resumeRes.success).toBe(true);
      expect(resumeRes.message).toContain('resumed');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        prisma,
        mockOrgId,
        mockUser.id,
        'JOB_QUEUE_RESUMED',
        'JOB_QUEUE',
        JobQueueName.JOBS,
        expect.any(Object),
      );
    });

    it('should retry a failed JobExecution, reset status to PENDING and re-enqueue in BullMQ', async () => {
      const failedExec = {
        id: 'exec-fail-1',
        organizationId: mockOrgId,
        jobType: JobType.INVOICE_GENERATION,
        queueName: 'propertyos:jobs',
        status: JobExecutionStatus.FAILED,
        error: 'Previous timeout error',
        attempts: 3,
        payload: { targetDate: '2026-09-01' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.jobExecution.findFirst.mockResolvedValue(failedExec);
      prisma.jobExecution.update
        .mockResolvedValueOnce({ ...failedExec, status: JobExecutionStatus.PENDING, attempts: 0, error: null })
        .mockResolvedValueOnce({ ...failedExec, status: JobExecutionStatus.PENDING, bullJobId: 'job_retry_1' });

      const retried = await jobsService.retryExecution(mockOrgId, mockUser, 'exec-fail-1');

      expect(prisma.jobExecution.update).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalledWith(
        prisma,
        mockOrgId,
        mockUser.id,
        'JOB_RETRY_TRIGGERED',
        'JOB_EXECUTION',
        'exec-fail-1',
        expect.any(Object),
      );
      expect(retried.status).toBe(JobExecutionStatus.PENDING);
    });

    it('should reject retrying a job that is not in FAILED status', async () => {
      prisma.jobExecution.findFirst.mockResolvedValue({
        id: 'exec-completed',
        organizationId: mockOrgId,
        status: JobExecutionStatus.COMPLETED,
      });

      await expect(
        jobsService.retryExecution(mockOrgId, mockUser, 'exec-completed'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ----------------------------------------------------------------------------
  // SUITE 9: Scheduled Job Configs & Crons
  // ----------------------------------------------------------------------------
  describe('9. Scheduled Job Configs & Crons', () => {
    it('should seed default schedules if none exist for organization', async () => {
      prisma.scheduledJobConfig.findMany
        .mockResolvedValueOnce([]) // initial empty
        .mockResolvedValueOnce(
          Object.values(JobType).map((jt) => ({
            id: `cfg-${jt}`,
            organizationId: mockOrgId,
            jobType: jt,
            cronExpression: '0 0 1 * *',
            isEnabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );

      const schedules = await jobsService.getSchedules(mockOrgId, mockUser);
      expect(schedules.length).toBe(6);
      expect(prisma.scheduledJobConfig.upsert).toHaveBeenCalledTimes(6);
    });

    it('should update cron expression and enabled status for a job schedule with audit logging', async () => {
      prisma.scheduledJobConfig.findUnique.mockResolvedValue({
        id: 'cfg-inv',
        organizationId: mockOrgId,
        jobType: JobType.INVOICE_GENERATION,
        cronExpression: '0 0 1 * *',
        isEnabled: true,
      });

      prisma.scheduledJobConfig.upsert.mockResolvedValue({
        id: 'cfg-inv',
        organizationId: mockOrgId,
        jobType: JobType.INVOICE_GENERATION,
        cronExpression: '0 6 1 * *',
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await jobsService.updateSchedule(
        mockOrgId,
        mockUser,
        JobType.INVOICE_GENERATION,
        {
          cronExpression: '0 6 1 * *',
        },
      );

      expect(updated.cronExpression).toBe('0 6 1 * *');
      expect(auditService.logEvent).toHaveBeenCalledWith(
        prisma,
        mockOrgId,
        mockUser.id,
        'SCHEDULE_CONFIG_UPDATED',
        'SCHEDULED_JOB_CONFIG',
        'cfg-inv',
        expect.any(Object),
      );
    });
  });

  // ----------------------------------------------------------------------------
  // SUITE 10: Graceful Shutdown
  // ----------------------------------------------------------------------------
  describe('10. Graceful Shutdown Lifecycle', () => {
    it('should close queues and workers cleanly without errors', async () => {
      await jobsService.onModuleInit();
      await workerService.onModuleInit();

      await expect(jobsService.onApplicationShutdown()).resolves.not.toThrow();
      await expect(workerService.onApplicationShutdown()).resolves.not.toThrow();
      await expect(redisProvider.onApplicationShutdown()).resolves.not.toThrow();
    });
  });
});
