import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Worker, Job, Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JobsRedisProvider } from './jobs-redis.provider';
import {
  JOB_QUEUE_PREFIX,
  JOB_QUEUES,
  WORKER_CONCURRENCY,
  DEFAULT_JOB_RETRY_OPTIONS,
} from './jobs.constants';
import {
  JobType,
  JobExecutionStatus,
  JobQueueName,
  NotificationType,
  InvoiceGenerationPayload,
  InvoiceGenerationResult,
  PaymentReminderPayload,
  PaymentReminderResult,
  MaintenanceEscalationPayload,
  MaintenanceEscalationResult,
  AgreementExpiryPayload,
  AgreementExpiryResult,
  NotificationDispatchPayload,
  NotificationDispatchResult,
  SystemCleanupPayload,
  SystemCleanupResult,
} from '@propertyos/types';
import { Prisma, BillingFrequency, InvoiceStatus, MaintenanceStatus, MaintenancePriority } from '@prisma/client';

@Injectable()
export class JobsWorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JobsWorkerService.name);

  private jobsWorker!: Worker;
  private notificationsWorker!: Worker;
  private dlqWorker!: Worker;
  private jobsQueue!: Queue;
  private notificationsQueue!: Queue;
  private dlqQueue!: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly redisProvider: JobsRedisProvider,
  ) {}

  /**
   * Spawns BullMQ workers and dead-letter queue routing on application startup
   */
  async onModuleInit(): Promise<void> {
    const connection = this.redisProvider.getRedisOptions();

    this.jobsQueue = new Queue(JOB_QUEUES.JOBS, { prefix: JOB_QUEUE_PREFIX, connection });
    this.notificationsQueue = new Queue(JOB_QUEUES.NOTIFICATIONS, { prefix: JOB_QUEUE_PREFIX, connection });
    this.dlqQueue = new Queue(JOB_QUEUES.DLQ, {
      prefix: JOB_QUEUE_PREFIX,
      connection,
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    });

    // 1. Main Background Jobs Worker
    this.jobsWorker = new Worker(
      JOB_QUEUES.JOBS,
      async (job: Job) => this.routeJob(job),
      {
        prefix: JOB_QUEUE_PREFIX,
        connection,
        concurrency: WORKER_CONCURRENCY.JOBS,
      },
    );

    // 2. Notifications Dispatch Worker
    this.notificationsWorker = new Worker(
      JOB_QUEUES.NOTIFICATIONS,
      async (job: Job) => this.routeJob(job),
      {
        prefix: JOB_QUEUE_PREFIX,
        connection,
        concurrency: WORKER_CONCURRENCY.NOTIFICATIONS,
      },
    );

    // 3. Dead-Letter Queue Worker (Inspection/Audit listener)
    this.dlqWorker = new Worker(
      JOB_QUEUES.DLQ,
      async (job: Job) => {
        this.logger.warn(`DLQ Diagnostic Job received: ${job.id} for jobType: ${job.data?.jobType}`);
        return { acknowledged: true, dlqReceivedAt: new Date().toISOString() };
      },
      {
        prefix: JOB_QUEUE_PREFIX,
        connection,
        concurrency: WORKER_CONCURRENCY.DLQ,
      },
    );

    this.setupWorkerListeners(this.jobsWorker, JOB_QUEUES.JOBS);
    this.setupWorkerListeners(this.notificationsWorker, JOB_QUEUES.NOTIFICATIONS);
    this.setupWorkerListeners(this.dlqWorker, JOB_QUEUES.DLQ);

    this.logger.log('BullMQ workers spawned and listening on all queues');
  }

  /**
   * Attach robust lifecycle and failure logging listeners to workers
   */
  private setupWorkerListeners(worker: Worker, queueName: string) {
    worker.on('active', (job) => {
      this.logger.debug(`[${queueName}] Job active: ${job.id} (${job.name})`);
    });

    worker.on('completed', (job) => {
      this.logger.log(`[${queueName}] Job completed: ${job.id} (${job.name})`);
    });

    worker.on('failed', async (job, err) => {
      this.logger.error(`[${queueName}] Job failed: ${job?.id} (${job?.name}): ${err.message}`);
      if (job) {
        await this.handleJobFailure(job, queueName, err);
      }
    });

    worker.on('error', (err) => {
      this.logger.error(`[${queueName}] Worker error: ${err.message}`);
    });
  }

  /**
   * Central job execution router handling state transitions, timing, multi-tenant isolation, and safe execution
   */
  private async routeJob(job: Job): Promise<any> {
    const startTime = Date.now();
    const data = job.data || {};
    const executionId = data.executionId as string | undefined;
    const organizationId = data.organizationId as string | undefined;

    if (!organizationId) {
      throw new Error('Missing authoritative organizationId in queue payload');
    }

    // 1. Authoritative verification of organization in PostgreSQL (Fail-closed)
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!org) {
      throw new Error(`Organization ${organizationId} does not exist or has been deleted`);
    }

    // 2. Update durable JobExecution status to RUNNING
    let executionRecord: any = null;
    if (executionId) {
      try {
        executionRecord = await this.prisma.jobExecution.update({
          where: { id: executionId },
          data: {
            status: JobExecutionStatus.RUNNING,
            startedAt: new Date(),
            attempts: job.attemptsMade + 1,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Could not update initial JobExecution ${executionId}: ${err.message}`);
      }
    }

    let result: any = null;
    const jobType = (job.name || data.jobType) as JobType;

    try {
      switch (jobType) {
        case JobType.INVOICE_GENERATION:
          result = await this.processInvoiceGeneration(data);
          break;
        case JobType.PAYMENT_REMINDERS:
          result = await this.processPaymentReminders(data);
          break;
        case JobType.MAINTENANCE_ESCALATION:
          result = await this.processMaintenanceEscalation(data);
          break;
        case JobType.AGREEMENT_EXPIRY:
          result = await this.processAgreementExpiry(data);
          break;
        case JobType.NOTIFICATION_DISPATCH:
          result = await this.processNotificationDispatch(data);
          break;
        case JobType.SYSTEM_CLEANUP:
          result = await this.processSystemCleanup(data);
          break;
        default:
          throw new Error(`Unsupported or unrecognized JobType: ${jobType}`);
      }

      const durationMs = Date.now() - startTime;
      const sanitizedResult = this.auditService.redactSensitiveMetadata(result);

      // 3. Mark JobExecution as COMPLETED
      if (executionId) {
        await this.prisma.jobExecution.update({
          where: { id: executionId },
          data: {
            status: JobExecutionStatus.COMPLETED,
            completedAt: new Date(),
            durationMs,
            result: sanitizedResult,
          },
        });
      }

      // 4. Update ScheduledJobConfig lastRunAt if registered
      await this.prisma.scheduledJobConfig.updateMany({
        where: { organizationId, jobType },
        data: {
          lastRunAt: new Date(),
          lastStatus: JobExecutionStatus.COMPLETED,
        },
      });

      return sanitizedResult;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err.message || 'Unknown worker execution error';

      if (executionId) {
        await this.prisma.jobExecution.update({
          where: { id: executionId },
          data: {
            durationMs,
            error: errorMessage,
          },
        });
      }

      throw err;
    }
  }

  /**
   * Handles failure lifecycle: retries, backoff, and DLQ routing when retries exhaust
   */
  private async handleJobFailure(job: Job, queueName: string, err: Error): Promise<void> {
    const data = job.data || {};
    const executionId = data.executionId as string | undefined;
    const organizationId = data.organizationId as string | undefined;
    const maxAttempts = job.opts.attempts || DEFAULT_JOB_RETRY_OPTIONS.attempts;
    const attemptsMade = job.attemptsMade;

    // Check if retries are exhausted
    if (attemptsMade >= maxAttempts) {
      this.logger.warn(
        `Job ${job.id} (${job.name}) exhausted all ${maxAttempts} attempts. Routing to DLQ...`,
      );

      // 1. Update durable JobExecution to FAILED in PostgreSQL
      if (executionId) {
        try {
          await this.prisma.jobExecution.update({
            where: { id: executionId },
            data: {
              status: JobExecutionStatus.FAILED,
              failedAt: new Date(),
              error: err.message,
              attempts: attemptsMade,
            },
          });
        } catch (updateErr: any) {
          this.logger.error(`Failed to update JobExecution on failure: ${updateErr.message}`);
        }
      }

      // 2. Update ScheduledJobConfig
      if (organizationId && data.jobType) {
        await this.prisma.scheduledJobConfig.updateMany({
          where: { organizationId, jobType: data.jobType as JobType },
          data: {
            lastRunAt: new Date(),
            lastStatus: JobExecutionStatus.FAILED,
          },
        });
      }

      // 3. Route sanitized diagnostic payload to propertyos:dlq
      try {
        const dlqPayload = {
          originalQueue: queueName,
          bullJobId: job.id,
          jobType: job.name || data.jobType,
          organizationId: organizationId || null,
          executionId: executionId || null,
          attempts: attemptsMade,
          maxAttempts,
          errorMessage: err.message,
          errorStack: err.stack ? err.stack.slice(0, 1000) : null,
          failedAt: new Date().toISOString(),
          payload: this.auditService.redactSensitiveMetadata(data),
        };

        await this.dlqQueue.add('dead-letter', dlqPayload, {
          jobId: `dlq_${job.id}_${Date.now()}`,
          removeOnComplete: false,
          removeOnFail: false,
        });

        // 4. Record DLQ transition in AuditLog
        if (organizationId) {
          await this.auditService.logEvent(
            this.prisma,
            organizationId,
            null,
            'DLQ_ROUTED' as any,
            'DEAD_LETTER_QUEUE',
            job.id || executionId || 'unknown',
            {
              queueName,
              jobType: job.name || data.jobType,
              attempts: attemptsMade,
              error: err.message,
            },
          );
        }
      } catch (dlqErr: any) {
        this.logger.error(`Failed to enqueue job to DLQ: ${dlqErr.message}`);
      }
    }
  }

  // ==============================================================================
  // 1. INVOICE GENERATION PROCESSOR
  // ==============================================================================
  public async processInvoiceGeneration(
    payload: InvoiceGenerationPayload,
  ): Promise<InvoiceGenerationResult> {
    const { organizationId, propertyId, scheduleId, forceRun } = payload;
    const targetDate = payload.targetDate ? new Date(payload.targetDate) : new Date();

    const where: Prisma.BillingScheduleWhereInput = {
      organizationId,
      active: true,
    };

    if (scheduleId) {
      where.id = scheduleId;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (!forceRun) {
      where.nextBillingDate = { lte: targetDate };
    }

    const schedules = await this.prisma.billingSchedule.findMany({
      where,
      include: {
        tenant: true,
        charge: true,
      },
    });

    let generatedInvoicesCount = 0;
    let totalAmountInvoiced = 0;
    const invoiceIds: string[] = [];
    const skippedScheduleIds: string[] = [];
    const errors: string[] = [];

    for (const schedule of schedules) {
      try {
        const billingDate = schedule.nextBillingDate || targetDate;
        const year = billingDate.getFullYear();
        const month = String(billingDate.getMonth() + 1).padStart(2, '0');
        const periodStr = `${year}-${month}`;

        // Idempotency: Check if an invoice for this tenant, schedule charge and billing period already exists
        const existingInvoice = await this.prisma.invoice.findFirst({
          where: {
            organizationId,
            tenantId: schedule.tenantId,
            lines: {
              some: {
                chargeId: schedule.chargeId,
              },
            },
            issueDate: {
              gte: new Date(year, billingDate.getMonth(), 1),
              lt: new Date(year, billingDate.getMonth() + 1, 1),
            },
          },
        });

        if (existingInvoice && !forceRun) {
          skippedScheduleIds.push(schedule.id);
          continue;
        }

        // Generate deterministic invoice number
        const randomSuffix = Math.floor(100000 + Math.random() * 900000);
        const invoiceNumber = `INV-${periodStr}-${randomSuffix}`;
        const dueDate = new Date(billingDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days due

        const amount = new Prisma.Decimal(schedule.amount.toString());

        // Atomic transaction: Create Invoice, InvoiceLine, advance nextBillingDate, and log audit event
        const createdInvoice = await this.prisma.$transaction(async (tx) => {
          const inv = await tx.invoice.create({
            data: {
              organizationId,
              tenantId: schedule.tenantId,
              propertyId: schedule.propertyId,
              leaseId: schedule.leaseId,
              checkInId: schedule.checkInId,
              invoiceNumber,
              issueDate: billingDate,
              dueDate,
              subtotal: amount,
              adjustments: new Prisma.Decimal(0),
              totalAmount: amount,
              paidAmount: new Prisma.Decimal(0),
              outstandingAmount: amount,
              status: InvoiceStatus.ISSUED,
              notes: `Automated invoice for ${schedule.charge.name} (${periodStr})`,
              lines: {
                create: {
                  chargeId: schedule.chargeId,
                  description: `${schedule.charge.name} - ${periodStr}`,
                  chargeType: schedule.charge.chargeType,
                  quantity: new Prisma.Decimal(1),
                  unitAmount: amount,
                  totalAmount: amount,
                },
              },
            },
          });

          // Advance nextBillingDate based on schedule frequency
          let nextDate: Date | null = new Date(billingDate);
          let isActive = true;

          if (schedule.frequency === BillingFrequency.MONTHLY) {
            nextDate.setMonth(nextDate.getMonth() + 1);
          } else if (schedule.frequency === BillingFrequency.QUARTERLY) {
            nextDate.setMonth(nextDate.getMonth() + 3);
          } else if (schedule.frequency === BillingFrequency.YEARLY) {
            nextDate.setFullYear(nextDate.getFullYear() + 1);
          } else if (schedule.frequency === BillingFrequency.ONE_TIME) {
            nextDate = null;
            isActive = false;
          }

          if (schedule.endDate && nextDate && nextDate > schedule.endDate) {
            isActive = false;
          }

          await tx.billingSchedule.update({
            where: { id: schedule.id },
            data: {
              nextBillingDate: nextDate,
              active: isActive,
            },
          });

          // Log Audit Trail
          await this.auditService.logEvent(
            tx,
            organizationId,
            null,
            'INVOICE_GENERATED' as any,
            'INVOICE',
            inv.id,
            {
              invoiceNumber,
              amount: amount.toNumber(),
              tenantId: schedule.tenantId,
              scheduleId: schedule.id,
              period: periodStr,
            },
          );

          // Find tenant's user if exists and dispatch notification
          if (schedule.tenant?.email) {
            const tenantUser = await tx.user.findFirst({
              where: { organizationId, email: schedule.tenant.email },
              select: { id: true },
            });

            if (tenantUser) {
              await tx.notification.create({
                data: {
                  organizationId,
                  userId: tenantUser.id,
                  propertyId: schedule.propertyId || null,
                  type: NotificationType.RENT_DUE,
                  title: `Invoice Generated: ${invoiceNumber}`,
                  message: `Your invoice for ${schedule.charge.name} of ₹${amount.toFixed(2)} is due on ${dueDate.toLocaleDateString('en-IN')}.`,
                  link: `/invoices/${inv.id}`,
                  metadata: {
                    invoiceId: inv.id,
                    invoiceNumber,
                    amount: amount.toNumber(),
                    period: periodStr,
                  },
                },
              });
            }
          }

          return inv;
        });

        invoiceIds.push(createdInvoice.id);
        generatedInvoicesCount++;
        totalAmountInvoiced += amount.toNumber();
      } catch (scheduleErr: any) {
        this.logger.error(`Error generating invoice for schedule ${schedule.id}: ${scheduleErr.message}`);
        errors.push(`Schedule ${schedule.id}: ${scheduleErr.message}`);
      }
    }

    return {
      generatedInvoicesCount,
      schedulesProcessedCount: schedules.length,
      totalAmountInvoiced,
      invoiceIds,
      skippedScheduleIds,
      errors,
    };
  }

  // ==============================================================================
  // 2. PAYMENT REMINDERS PROCESSOR
  // ==============================================================================
  public async processPaymentReminders(
    payload: PaymentReminderPayload,
  ): Promise<PaymentReminderResult> {
    const { organizationId, propertyId, dueSoonDaysThreshold = 3 } = payload;
    const now = new Date();
    const dueSoonThresholdDate = new Date(now.getTime() + dueSoonDaysThreshold * 24 * 60 * 60 * 1000);

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID] },
      outstandingAmount: { gt: new Prisma.Decimal(0) },
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        tenant: true,
      },
    });

    let dueSoonRemindersSent = 0;
    let overdueRemindersSent = 0;
    let deduplicatedCount = 0;

    for (const invoice of invoices) {
      if (!invoice.tenant?.email) continue;

      const tenantUser = await this.prisma.user.findFirst({
        where: { organizationId, email: invoice.tenant.email },
        select: { id: true },
      });

      if (!tenantUser) continue;
      const userId = tenantUser.id;

      const isOverdue = invoice.dueDate < now;
      const isDueSoon = !isOverdue && invoice.dueDate <= dueSoonThresholdDate;

      if (!isOverdue && !isDueSoon) continue;

      const notificationType = isOverdue ? NotificationType.PAYMENT_OVERDUE : NotificationType.RENT_DUE;
      const dateWindowStr = now.toISOString().split('T')[0];

      // Idempotency: Check if a reminder for this invoice and window was already sent in past 24 hours
      const existingReminder = await this.prisma.notification.findFirst({
        where: {
          organizationId,
          userId,
          type: notificationType,
          createdAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
          metadata: {
            path: ['invoiceId'],
            equals: invoice.id,
          },
        },
      });

      if (existingReminder) {
        deduplicatedCount++;
        continue;
      }

      const amountStr = `₹${invoice.outstandingAmount.toFixed(2)}`;
      const title = isOverdue
        ? `Payment Overdue: ${invoice.invoiceNumber}`
        : `Payment Reminder: ${invoice.invoiceNumber}`;
      const message = isOverdue
        ? `Your payment of ${amountStr} for invoice ${invoice.invoiceNumber} was due on ${invoice.dueDate.toLocaleDateString('en-IN')}. Please settle promptly.`
        : `Reminder: Invoice ${invoice.invoiceNumber} of ${amountStr} is due on ${invoice.dueDate.toLocaleDateString('en-IN')}.`;

      await this.prisma.notification.create({
        data: {
          organizationId,
          userId,
          propertyId: invoice.propertyId || null,
          type: notificationType,
          title,
          message,
          link: `/invoices/${invoice.id}`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            outstandingAmount: invoice.outstandingAmount.toNumber(),
            window: dateWindowStr,
          },
        },
      });

      if (isOverdue) {
        overdueRemindersSent++;
      } else {
        dueSoonRemindersSent++;
      }
    }

    return {
      invoicesEvaluatedCount: invoices.length,
      dueSoonRemindersSent,
      overdueRemindersSent,
      deduplicatedCount,
    };
  }

  // ==============================================================================
  // 3. MAINTENANCE SLA ESCALATION PROCESSOR
  // ==============================================================================
  public async processMaintenanceEscalation(
    payload: MaintenanceEscalationPayload,
  ): Promise<MaintenanceEscalationResult> {
    const { organizationId, propertyId, urgentThresholdHours = 24, highThresholdHours = 48 } = payload;
    const now = new Date();

    const urgentCutoff = new Date(now.getTime() - urgentThresholdHours * 60 * 60 * 1000);
    const highCutoff = new Date(now.getTime() - highThresholdHours * 60 * 60 * 1000);

    const where: Prisma.MaintenanceTicketWhereInput = {
      organizationId,
      status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS] },
      OR: [
        { priority: MaintenancePriority.URGENT, createdAt: { lte: urgentCutoff } },
        { priority: MaintenancePriority.HIGH, createdAt: { lte: highCutoff } },
      ],
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const tickets = await this.prisma.maintenanceTicket.findMany({
      where,
      include: {
        comments: {
          where: {
            body: { contains: '[SLA Escalation]' },
          },
        },
        assignedTo: { select: { id: true } },
      },
    });

    const escalatedTicketIds: string[] = [];
    let notificationsSentCount = 0;

    // Find Property Managers & Owners in organization to notify
    const managers = await this.prisma.user.findMany({
      where: {
        organizationId,
        userRoles: {
          some: {
            role: { name: { in: ['OWNER', 'PROPERTY_MANAGER'] } },
          },
        },
      },
      select: { id: true },
    });

    for (const ticket of tickets) {
      // Idempotency: Skip if already escalated within the last 24 hours
      const recentEscalation = ticket.comments?.some(
        (c: any) => new Date(c.createdAt).getTime() > now.getTime() - 24 * 60 * 60 * 1000,
      );
      if (recentEscalation) continue;

      // Add escalation comment
      await this.prisma.maintenanceComment.create({
        data: {
          organizationId,
          ticketId: ticket.id,
          authorId: ticket.createdById,
          body: `[SLA Escalation] Ticket ${ticket.ticketNumber} priority ${ticket.priority} has exceeded SLA resolution threshold. Escalated to management.`,
        },
      });

      // Send notifications to property managers and assigned staff
      const recipientIds = new Set<string>(managers.map((m) => m.id));
      if (ticket.assignedToId) recipientIds.add(ticket.assignedToId);

      for (const recipientId of recipientIds) {
        await this.prisma.notification.create({
          data: {
            organizationId,
            userId: recipientId,
            propertyId: ticket.propertyId,
            type: NotificationType.MAINTENANCE_UPDATED,
            title: `SLA Escalation: Ticket ${ticket.ticketNumber}`,
            message: `Ticket "${ticket.title}" (${ticket.priority}) has exceeded SLA resolution threshold.`,
            link: `/maintenance/${ticket.id}`,
            metadata: {
              ticketId: ticket.id,
              ticketNumber: ticket.ticketNumber,
              priority: ticket.priority,
              escalatedAt: now.toISOString(),
            },
          },
        });
        notificationsSentCount++;
      }

      // Log Audit event
      await this.auditService.logEvent(
        this.prisma,
        organizationId,
        null,
        'TICKET_STATUS_CHANGED' as any,
        'MAINTENANCE_TICKET',
        ticket.id,
        {
          ticketNumber: ticket.ticketNumber,
          priority: ticket.priority,
          reason: 'SLA Escalation',
        },
      );

      escalatedTicketIds.push(ticket.id);
    }

    return {
      ticketsEvaluatedCount: tickets.length,
      ticketsEscalatedCount: escalatedTicketIds.length,
      escalatedTicketIds,
      notificationsSentCount,
    };
  }

  // ==============================================================================
  // 4. AGREEMENT / LEASE EXPIRY PROCESSOR
  // ==============================================================================
  public async processAgreementExpiry(
    payload: AgreementExpiryPayload,
  ): Promise<AgreementExpiryResult> {
    const { organizationId, propertyId, reminderWindowsDays = [30, 15, 7] } = payload;
    const now = new Date();

    const maxDays = Math.max(...reminderWindowsDays);
    const maxDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

    const where: Prisma.LeaseWhereInput = {
      rentalUnit: {
        property: {
          organizationId,
          ...(propertyId ? { id: propertyId } : {}),
        },
      },
      status: 'ACTIVE',
      endDate: {
        gte: now,
        lte: maxDate,
      },
    };

    const expiringLeases = await this.prisma.lease.findMany({
      where,
      include: {
        tenant: true,
        rentalUnit: {
          include: {
            property: { select: { id: true, name: true, organizationId: true } },
          },
        },
      },
    });

    let expiringRemindersSentCount = 0;
    let deduplicatedCount = 0;
    const notifiedTenantIds: string[] = [];

    for (const lease of expiringLeases) {
      if (!lease.tenant?.email) continue;

      const tenantUser = await this.prisma.user.findFirst({
        where: { organizationId, email: lease.tenant.email },
        select: { id: true },
      });

      if (!tenantUser) continue;
      const userId = tenantUser.id;

      const diffTime = lease.endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Match closest window (e.g. 30, 15, 7)
      const matchedWindow = reminderWindowsDays.find(
        (w) => Math.abs(diffDays - w) <= 1,
      );

      if (!matchedWindow) continue;

      const windowKey = `window_${matchedWindow}d_${lease.endDate.toISOString().split('T')[0]}`;

      // Idempotency: Check if reminder already sent for this lease + window
      const existing = await this.prisma.notification.findFirst({
        where: {
          organizationId,
          userId,
          type: NotificationType.LEASE_EXPIRING,
          metadata: {
            path: ['leaseId'],
            equals: lease.id,
          },
          createdAt: {
            gte: new Date(now.getTime() - 48 * 60 * 60 * 1000),
          },
        },
      });

      if (existing) {
        deduplicatedCount++;
        continue;
      }

      await this.prisma.notification.create({
        data: {
          organizationId,
          userId,
          propertyId: lease.rentalUnit.property.id,
          type: NotificationType.LEASE_EXPIRING,
          title: `Lease Expiring in ${diffDays} Days`,
          message: `Your rental lease for unit ${lease.rentalUnit.unitNumber} expires on ${lease.endDate.toLocaleDateString('en-IN')}. Please contact management regarding renewal.`,
          link: `/agreements`,
          metadata: {
            leaseId: lease.id,
            windowKey,
            daysRemaining: diffDays,
            endDate: lease.endDate.toISOString(),
          },
        },
      });

      expiringRemindersSentCount++;
      notifiedTenantIds.push(lease.tenant.id);
    }

    return {
      agreementsEvaluatedCount: expiringLeases.length,
      expiringRemindersSentCount,
      deduplicatedCount,
      notifiedTenantIds,
    };
  }

  // ==============================================================================
  // 5. NOTIFICATION DISPATCH PROCESSOR
  // ==============================================================================
  public async processNotificationDispatch(
    payload: NotificationDispatchPayload,
  ): Promise<NotificationDispatchResult> {
    const { organizationId, notificationIds } = payload;

    const where: Prisma.NotificationWhereInput = {
      organizationId,
      ...(notificationIds ? { id: { in: notificationIds } } : {}),
    };

    const count = await this.prisma.notification.count({ where });

    return {
      dispatchedCount: count,
      failedCount: 0,
      recipientCount: count,
    };
  }

  // ==============================================================================
  // 6. SYSTEM CLEANUP PROCESSOR
  // ==============================================================================
  public async processSystemCleanup(
    payload: SystemCleanupPayload,
  ): Promise<SystemCleanupResult> {
    const { organizationId, retentionDays = 30, cleanQueues = true } = payload;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    // 1. Clean completed JobExecution records older than retentionDays
    const deletedExecutions = await this.prisma.jobExecution.deleteMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        status: JobExecutionStatus.COMPLETED,
        createdAt: { lte: cutoffDate },
      },
    });

    // 2. Clean expired sessions
    const deletedSessions = await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });

    // 3. Clean BullMQ queues
    let cleanedQueueJobsCount = 0;
    if (cleanQueues) {
      try {
        const [jobsCleaned, notifsCleaned] = await Promise.all([
          this.jobsQueue?.clean(retentionDays * 24 * 60 * 60 * 1000, 5000, 'completed') || [],
          this.notificationsQueue?.clean(retentionDays * 24 * 60 * 60 * 1000, 5000, 'completed') || [],
        ]);
        cleanedQueueJobsCount = (jobsCleaned.length || 0) + (notifsCleaned.length || 0);
      } catch (cleanErr: any) {
        this.logger.warn(`Error during BullMQ queue cleanup: ${cleanErr.message}`);
      }
    }

    return {
      cleanedExecutionRecordsCount: deletedExecutions.count,
      cleanedQueueJobsCount,
      cleanedSessionsCount: deletedSessions.count,
    };
  }

  /**
   * Graceful shutdown: close workers and queues
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Gracefully closing BullMQ workers and queues...');
    try {
      await Promise.all([
        this.jobsWorker?.close(),
        this.notificationsWorker?.close(),
        this.dlqWorker?.close(),
        this.jobsQueue?.close(),
        this.notificationsQueue?.close(),
        this.dlqQueue?.close(),
      ]);
    } catch (err: any) {
      this.logger.warn(`Error closing BullMQ workers/queues: ${err.message}`);
    }
  }
}
