import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JobsRedisProvider } from './jobs-redis.provider';
import {
  JOB_QUEUE_PREFIX,
  JOB_QUEUES,
  FULL_QUEUE_NAMES,
  DEFAULT_CRON_SCHEDULES,
  DEFAULT_JOB_RETRY_OPTIONS,
} from './jobs.constants';
import {
  JobType,
  JobExecutionStatus,
  JobQueueName,
  JobExecutionDto,
  ScheduledJobConfigDto,
  QueueStatsDto,
  QueueJobMetricsDto,
  TriggerJobInputDto,
  UpdateScheduleConfigDto,
  JobExecutionFilterQueryDto,
  QueueOperationResponseDto,
  AuthUser,
} from '@propertyos/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class JobsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);

  private jobsQueue!: Queue;
  private notificationsQueue!: Queue;
  private dlqQueue!: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly redisProvider: JobsRedisProvider,
  ) {}

  /**
   * Initializes BullMQ queues on startup with propertyos prefix
   */
  async onModuleInit(): Promise<void> {
    const connection = this.redisProvider.getRedisOptions();

    this.jobsQueue = new Queue(JOB_QUEUES.JOBS, {
      prefix: JOB_QUEUE_PREFIX,
      connection,
      defaultJobOptions: DEFAULT_JOB_RETRY_OPTIONS,
    });

    this.notificationsQueue = new Queue(JOB_QUEUES.NOTIFICATIONS, {
      prefix: JOB_QUEUE_PREFIX,
      connection,
      defaultJobOptions: DEFAULT_JOB_RETRY_OPTIONS,
    });

    this.dlqQueue = new Queue(JOB_QUEUES.DLQ, {
      prefix: JOB_QUEUE_PREFIX,
      connection,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    });

    this.logger.log('BullMQ queues initialized: propertyos:jobs, propertyos:notifications, propertyos:dlq');
  }

  /**
   * Format Prisma JobExecution to JobExecutionDto
   */
  private formatExecution(item: any): JobExecutionDto {
    return {
      id: item.id,
      organizationId: item.organizationId,
      jobType: item.jobType as JobType,
      queueName: item.queueName,
      bullJobId: item.bullJobId ?? null,
      status: item.status as JobExecutionStatus,
      payload: (item.payload as Record<string, any>) ?? null,
      result: (item.result as Record<string, any>) ?? null,
      error: item.error ?? null,
      durationMs: item.durationMs ?? null,
      attempts: item.attempts,
      maxAttempts: item.maxAttempts,
      scheduledAt: item.scheduledAt ? item.scheduledAt.toISOString() : null,
      startedAt: item.startedAt ? item.startedAt.toISOString() : null,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      failedAt: item.failedAt ? item.failedAt.toISOString() : null,
      triggeredById: item.triggeredById ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      triggeredBy: item.triggeredBy
        ? {
            id: item.triggeredBy.id,
            email: item.triggeredBy.email,
            firstName: item.triggeredBy.firstName,
            lastName: item.triggeredBy.lastName,
          }
        : null,
    };
  }

  /**
   * Format Prisma ScheduledJobConfig to ScheduledJobConfigDto
   */
  private formatScheduleConfig(item: any): ScheduledJobConfigDto {
    return {
      id: item.id,
      organizationId: item.organizationId,
      jobType: item.jobType as JobType,
      cronExpression: item.cronExpression,
      isEnabled: item.isEnabled,
      lastRunAt: item.lastRunAt ? item.lastRunAt.toISOString() : null,
      nextRunAt: item.nextRunAt ? item.nextRunAt.toISOString() : null,
      lastStatus: (item.lastStatus as JobExecutionStatus) ?? null,
      metadata: (item.metadata as Record<string, any>) ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  /**
   * Helper to retrieve BullMQ Queue instance by name
   */
  private getQueueByName(name: string): Queue {
    if (name === FULL_QUEUE_NAMES.JOBS || name === JOB_QUEUES.JOBS || name === JobQueueName.JOBS)
      return this.jobsQueue;
    if (
      name === FULL_QUEUE_NAMES.NOTIFICATIONS ||
      name === JOB_QUEUES.NOTIFICATIONS ||
      name === JobQueueName.NOTIFICATIONS
    )
      return this.notificationsQueue;
    if (name === FULL_QUEUE_NAMES.DLQ || name === JOB_QUEUES.DLQ || name === JobQueueName.DLQ)
      return this.dlqQueue;
    return this.jobsQueue;
  }

  /**
   * Get real-time queue metrics and Redis engine health
   */
  async getQueueStats(): Promise<QueueStatsDto> {
    const redisConnected = await this.redisProvider.isHealthy();

    const getMetrics = async (queue: Queue): Promise<QueueJobMetricsDto> => {
      try {
        const [counts, isPaused] = await Promise.all([
          queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
          queue.isPaused(),
        ]);
        return {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
          paused: isPaused,
        };
      } catch (err: any) {
        this.logger.warn(`Failed to get queue counts for ${queue.name}: ${err.message}`);
        return {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
        };
      }
    };

    const [jobsMetrics, notifMetrics, dlqMetrics] = await Promise.all([
      getMetrics(this.jobsQueue),
      getMetrics(this.notificationsQueue),
      getMetrics(this.dlqQueue),
    ]);

    return {
      engine: 'BullMQ + Redis',
      redisConnected,
      queues: {
        jobs: jobsMetrics,
        notifications: notifMetrics,
        dlq: dlqMetrics,
      },
      totalWorkers: 3,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Manually triggers a job for an organization, recording a durable JobExecution
   */
  async triggerJob(
    organizationId: string,
    user: AuthUser,
    input: TriggerJobInputDto,
  ): Promise<JobExecutionDto> {
    // 1. Verify organization exists
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // 2. Validate property if provided
    if (input.propertyId) {
      const property = await this.prisma.property.findFirst({
        where: { id: input.propertyId, organizationId },
        select: { id: true },
      });
      if (!property) {
        throw new NotFoundException('Property not found within organization');
      }
    }

    // 3. Determine target queue
    const queueName =
      input.jobType === JobType.NOTIFICATION_DISPATCH
        ? FULL_QUEUE_NAMES.NOTIFICATIONS
        : FULL_QUEUE_NAMES.JOBS;

    const targetQueue = this.getQueueByName(queueName);

    // 4. Sanitize parameters
    const safeParams = this.auditService.redactSensitiveMetadata(input.parameters || {});

    // 5. Create durable JobExecution in PostgreSQL
    const execution = await this.prisma.jobExecution.create({
      data: {
        organizationId,
        jobType: input.jobType,
        queueName,
        status: JobExecutionStatus.PENDING,
        payload: {
          ...safeParams,
          propertyId: input.propertyId || null,
          forceRun: input.forceRun || false,
        },
        scheduledAt: new Date(),
        triggeredById: user.id,
      },
      include: {
        triggeredBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // 6. Push to BullMQ queue
    const bullJob = await targetQueue.add(
      input.jobType,
      {
        executionId: execution.id,
        organizationId,
        jobType: input.jobType,
        propertyId: input.propertyId,
        forceRun: input.forceRun || false,
        parameters: safeParams,
      },
      {
        jobId: `job_${execution.id}`,
        ...DEFAULT_JOB_RETRY_OPTIONS,
      },
    );

    // 7. Update JobExecution with bullJobId
    const updated = await this.prisma.jobExecution.update({
      where: { id: execution.id },
      data: { bullJobId: bullJob.id },
      include: {
        triggeredBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // 8. Log audit trail
    await this.auditService.logEvent(
      this.prisma,
      organizationId,
      user.id,
      'JOB_MANUALLY_TRIGGERED' as any,
      'JOB_EXECUTION',
      execution.id,
      {
        jobType: input.jobType,
        queueName,
        bullJobId: bullJob.id,
        propertyId: input.propertyId || null,
      },
    );

    return this.formatExecution(updated);
  }

  /**
   * Lists durable job executions with multi-tenant isolation and rich filtering
   */
  async getExecutions(
    organizationId: string,
    user: AuthUser,
    query: JobExecutionFilterQueryDto = {},
  ): Promise<{
    data: JobExecutionDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.JobExecutionWhereInput = {
      organizationId,
    };

    if (query.jobType) {
      where.jobType = query.jobType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.queueName) {
      where.queueName = query.queueName;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.jobExecution.count({ where }),
      this.prisma.jobExecution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          triggeredBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map((i) => this.formatExecution(i)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves single JobExecution detail scoped to tenant organization
   */
  async getExecutionById(
    organizationId: string,
    user: AuthUser,
    id: string,
  ): Promise<JobExecutionDto> {
    const execution = await this.prisma.jobExecution.findFirst({
      where: { id, organizationId },
      include: {
        triggeredBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException('Job execution not found');
    }

    return this.formatExecution(execution);
  }

  /**
   * Pauses a BullMQ queue
   */
  async pauseQueue(
    organizationId: string,
    user: AuthUser,
    queueName: string,
  ): Promise<QueueOperationResponseDto> {
    const targetQueue = this.getQueueByName(queueName);
    await targetQueue.pause();

    await this.auditService.logEvent(
      this.prisma,
      organizationId,
      user.id,
      'JOB_QUEUE_PAUSED' as any,
      'JOB_QUEUE',
      queueName,
      { queueName },
    );

    return {
      success: true,
      message: `Queue ${queueName} paused successfully`,
      queueName,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Resumes a paused BullMQ queue
   */
  async resumeQueue(
    organizationId: string,
    user: AuthUser,
    queueName: string,
  ): Promise<QueueOperationResponseDto> {
    const targetQueue = this.getQueueByName(queueName);
    await targetQueue.resume();

    await this.auditService.logEvent(
      this.prisma,
      organizationId,
      user.id,
      'JOB_QUEUE_RESUMED' as any,
      'JOB_QUEUE',
      queueName,
      { queueName },
    );

    return {
      success: true,
      message: `Queue ${queueName} resumed successfully`,
      queueName,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Cleans completed/failed jobs from a BullMQ queue
   */
  async cleanQueue(
    organizationId: string,
    user: AuthUser,
    queueName: string,
    gracePeriodMs = 5000,
    limit = 1000,
  ): Promise<QueueOperationResponseDto> {
    const targetQueue = this.getQueueByName(queueName);
    const cleaned = await targetQueue.clean(gracePeriodMs, limit, 'completed');

    await this.auditService.logEvent(
      this.prisma,
      organizationId,
      user.id,
      'JOB_QUEUE_CLEANED' as any,
      'JOB_QUEUE',
      queueName,
      { queueName, gracePeriodMs, limit, cleanedCount: cleaned.length },
    );

    return {
      success: true,
      message: `Queue ${queueName} cleaned (${cleaned.length} jobs removed)`,
      queueName,
      timestamp: new Date().toISOString(),
      details: { cleanedJobsCount: cleaned.length },
    };
  }

  /**
   * Retries a failed execution or job from DLQ
   */
  async retryExecution(
    organizationId: string,
    user: AuthUser,
    id: string,
  ): Promise<JobExecutionDto> {
    const execution = await this.prisma.jobExecution.findFirst({
      where: { id, organizationId },
      include: {
        triggeredBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException('Job execution record not found');
    }

    if (execution.status !== JobExecutionStatus.FAILED) {
      throw new BadRequestException(
        `Cannot retry execution in status ${execution.status}. Only FAILED jobs can be retried.`,
      );
    }

    const queueName = execution.queueName || FULL_QUEUE_NAMES.JOBS;
    const targetQueue = this.getQueueByName(queueName);

    // Reset status to PENDING
    const updated = await this.prisma.jobExecution.update({
      where: { id },
      data: {
        status: JobExecutionStatus.PENDING,
        attempts: 0,
        error: null,
        failedAt: null,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
      },
      include: {
        triggeredBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Re-queue in BullMQ
    const bullJob = await targetQueue.add(
      execution.jobType,
      {
        executionId: execution.id,
        organizationId,
        jobType: execution.jobType,
        isRetry: true,
        ...(execution.payload as Record<string, any>),
      },
      {
        jobId: `retry_${execution.id}_${Date.now()}`,
        ...DEFAULT_JOB_RETRY_OPTIONS,
      },
    );

    await this.prisma.jobExecution.update({
      where: { id },
      data: { bullJobId: bullJob.id },
    });

    // Log audit event
    await this.auditService.logEvent(
      this.prisma,
      organizationId,
      user.id,
      'JOB_RETRY_TRIGGERED' as any,
      'JOB_EXECUTION',
      execution.id,
      {
        jobType: execution.jobType,
        newBullJobId: bullJob.id,
        previousError: execution.error,
      },
    );

    return this.formatExecution({ ...updated, bullJobId: bullJob.id });
  }

  /**
   * Lists or seeds default scheduled job configs for an organization
   */
  async getSchedules(
    organizationId: string,
    user: AuthUser,
  ): Promise<ScheduledJobConfigDto[]> {
    const existing = await this.prisma.scheduledJobConfig.findMany({
      where: { organizationId },
      orderBy: { jobType: 'asc' },
    });

    // If configs already exist for all types, return them
    const allTypes = Object.values(JobType);
    if (existing.length === allTypes.length) {
      return existing.map((item) => this.formatScheduleConfig(item));
    }

    // Seed missing default configs
    const existingMap = new Set(existing.map((e) => e.jobType));
    for (const jType of allTypes) {
      if (!existingMap.has(jType)) {
        await this.prisma.scheduledJobConfig.upsert({
          where: {
            organizationId_jobType: {
              organizationId,
              jobType: jType,
            },
          },
          create: {
            organizationId,
            jobType: jType,
            cronExpression: DEFAULT_CRON_SCHEDULES[jType],
            isEnabled: true,
          },
          update: {},
        });
      }
    }

    const configs = await this.prisma.scheduledJobConfig.findMany({
      where: { organizationId },
      orderBy: { jobType: 'asc' },
    });

    return configs.map((item) => this.formatScheduleConfig(item));
  }

  /**
   * Updates schedule cron expression or enabled flag for a job type
   */
  async updateSchedule(
    organizationId: string,
    user: AuthUser,
    jobType: JobType,
    input: UpdateScheduleConfigDto,
  ): Promise<ScheduledJobConfigDto> {
    const existing = await this.prisma.scheduledJobConfig.findUnique({
      where: {
        organizationId_jobType: {
          organizationId,
          jobType,
        },
      },
    });

    const updated = await this.prisma.scheduledJobConfig.upsert({
      where: {
        organizationId_jobType: {
          organizationId,
          jobType,
        },
      },
      create: {
        organizationId,
        jobType,
        cronExpression: input.cronExpression || DEFAULT_CRON_SCHEDULES[jobType],
        isEnabled: input.isEnabled !== undefined ? input.isEnabled : true,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      update: {
        ...(input.cronExpression ? { cronExpression: input.cronExpression } : {}),
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
      },
    });

    await this.auditService.logEvent(
      this.prisma,
      organizationId,
      user.id,
      'SCHEDULE_CONFIG_UPDATED' as any,
      'SCHEDULED_JOB_CONFIG',
      updated.id,
      {
        jobType,
        cronExpression: updated.cronExpression,
        isEnabled: updated.isEnabled,
        previousCron: existing?.cronExpression,
        previousEnabled: existing?.isEnabled,
      },
    );

    return this.formatScheduleConfig(updated);
  }

  /**
   * Graceful shutdown: close queues
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Closing BullMQ queues...');
    try {
      await Promise.all([
        this.jobsQueue?.close(),
        this.notificationsQueue?.close(),
        this.dlqQueue?.close(),
      ]);
    } catch (err: any) {
      this.logger.warn(`Error during queue shutdown: ${err.message}`);
    }
  }
}
