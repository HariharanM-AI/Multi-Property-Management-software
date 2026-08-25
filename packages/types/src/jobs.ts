// ==============================================================================
// PropertyOS Automated Job Scheduler & BullMQ Types (CORE-029)
// ==============================================================================

export enum JobType {
  INVOICE_GENERATION = 'INVOICE_GENERATION',
  PAYMENT_REMINDERS = 'PAYMENT_REMINDERS',
  MAINTENANCE_ESCALATION = 'MAINTENANCE_ESCALATION',
  AGREEMENT_EXPIRY = 'AGREEMENT_EXPIRY',
  NOTIFICATION_DISPATCH = 'NOTIFICATION_DISPATCH',
  SYSTEM_CLEANUP = 'SYSTEM_CLEANUP',
}

export enum JobExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum JobQueueName {
  JOBS = 'propertyos:jobs',
  NOTIFICATIONS = 'propertyos:notifications',
  DLQ = 'propertyos:dlq',
}

// ------------------------------------------------------------------------------
// DTOs & Payloads
// ------------------------------------------------------------------------------

export interface JobExecutionDto {
  id: string;
  organizationId: string;
  jobType: JobType;
  queueName: string;
  bullJobId?: string | null;
  status: JobExecutionStatus;
  payload?: Record<string, any> | null;
  result?: Record<string, any> | null;
  error?: string | null;
  durationMs?: number | null;
  attempts: number;
  maxAttempts: number;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  triggeredById?: string | null;
  createdAt: string;
  updatedAt: string;
  triggeredBy?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface ScheduledJobConfigDto {
  id: string;
  organizationId: string;
  jobType: JobType;
  cronExpression: string;
  isEnabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastStatus?: JobExecutionStatus | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueueJobMetricsDto {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface QueueStatsDto {
  engine: 'BullMQ + Redis';
  redisConnected: boolean;
  queues: {
    jobs: QueueJobMetricsDto;
    notifications: QueueJobMetricsDto;
    dlq: QueueJobMetricsDto;
  };
  totalWorkers: number;
  timestamp: string;
}

export interface TriggerJobInputDto {
  jobType: JobType;
  propertyId?: string;
  forceRun?: boolean;
  parameters?: Record<string, any>;
}

export interface UpdateScheduleConfigDto {
  cronExpression?: string;
  isEnabled?: boolean;
  metadata?: Record<string, any>;
}

export interface JobExecutionFilterQueryDto {
  page?: number;
  limit?: number;
  jobType?: JobType;
  status?: JobExecutionStatus;
  queueName?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface QueueOperationResponseDto {
  success: boolean;
  message: string;
  queueName: string;
  timestamp: string;
  details?: Record<string, any>;
}

// ------------------------------------------------------------------------------
// Specific Job Contracts (Payloads & Results)
// ------------------------------------------------------------------------------

export interface InvoiceGenerationPayload {
  organizationId: string;
  targetDate?: string;
  propertyId?: string;
  scheduleId?: string;
  forceRun?: boolean;
}

export interface InvoiceGenerationResult {
  generatedInvoicesCount: number;
  schedulesProcessedCount: number;
  totalAmountInvoiced: number;
  invoiceIds: string[];
  skippedScheduleIds: string[];
  errors: string[];
}

export interface PaymentReminderPayload {
  organizationId: string;
  propertyId?: string;
  dueSoonDaysThreshold?: number; // e.g. 3 days
  overdueGraceDays?: number; // e.g. 1 day
}

export interface PaymentReminderResult {
  invoicesEvaluatedCount: number;
  dueSoonRemindersSent: number;
  overdueRemindersSent: number;
  deduplicatedCount: number;
}

export interface MaintenanceEscalationPayload {
  organizationId: string;
  propertyId?: string;
  urgentThresholdHours?: number; // default 24h
  highThresholdHours?: number; // default 48h
}

export interface MaintenanceEscalationResult {
  ticketsEvaluatedCount: number;
  ticketsEscalatedCount: number;
  escalatedTicketIds: string[];
  notificationsSentCount: number;
}

export interface AgreementExpiryPayload {
  organizationId: string;
  propertyId?: string;
  reminderWindowsDays?: number[]; // e.g. [30, 15, 7]
}

export interface AgreementExpiryResult {
  agreementsEvaluatedCount: number;
  expiringRemindersSentCount: number;
  deduplicatedCount: number;
  notifiedTenantIds: string[];
}

export interface NotificationDispatchPayload {
  organizationId: string;
  notificationIds?: string[];
  batchSize?: number;
}

export interface NotificationDispatchResult {
  dispatchedCount: number;
  failedCount: number;
  recipientCount: number;
}

export interface SystemCleanupPayload {
  organizationId?: string;
  retentionDays?: number; // default 30
  cleanQueues?: boolean;
}

export interface SystemCleanupResult {
  cleanedExecutionRecordsCount: number;
  cleanedQueueJobsCount: number;
  cleanedSessionsCount: number;
}
