import { JobType } from '@propertyos/types';

export const JOB_QUEUE_PREFIX = 'propertyos';

export const JOB_QUEUES = {
  JOBS: 'jobs',
  NOTIFICATIONS: 'notifications',
  DLQ: 'dlq',
} as const;

export const FULL_QUEUE_NAMES = {
  JOBS: 'propertyos:jobs',
  NOTIFICATIONS: 'propertyos:notifications',
  DLQ: 'propertyos:dlq',
} as const;

export const DEFAULT_CRON_SCHEDULES: Record<JobType, string> = {
  [JobType.INVOICE_GENERATION]: '0 0 1 * *', // 1st of every month at midnight
  [JobType.PAYMENT_REMINDERS]: '0 8 * * *', // Daily at 08:00 AM
  [JobType.MAINTENANCE_ESCALATION]: '*/15 * * * *', // Every 15 minutes
  [JobType.AGREEMENT_EXPIRY]: '0 9 * * *', // Daily at 09:00 AM
  [JobType.NOTIFICATION_DISPATCH]: '* * * * *', // Every minute
  [JobType.SYSTEM_CLEANUP]: '0 2 * * *', // Daily at 02:00 AM
};

export const DEFAULT_JOB_RETRY_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    age: 86400 * 7, // retain completed for 7 days
    count: 5000,
  },
  removeOnFail: false, // retain failed in queue / move to DLQ on exhaustion
};

export const WORKER_CONCURRENCY = {
  JOBS: 5,
  NOTIFICATIONS: 10,
  DLQ: 2,
};
