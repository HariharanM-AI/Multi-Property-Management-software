import { z } from 'zod';
import { JobType, JobExecutionStatus } from '@propertyos/types';

// Standard 5-part cron expression regex supporting standard and step values (e.g. "0 0 1 * *", "*/15 * * * *", "0 8 * * *")
export const CRON_REGEX =
  /^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)|((((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*)\s+){4}((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*))$/;

export const TriggerJobSchema = z.object({
  jobType: z.nativeEnum(JobType, {
    errorMap: () => ({ message: 'Invalid or unsupported jobType' }),
  }),
  propertyId: z.string().uuid({ message: 'Invalid propertyId UUID' }).optional(),
  forceRun: z.boolean().optional().default(false),
  parameters: z.record(z.any()).optional().default({}),
});

export type TriggerJobInput = z.infer<typeof TriggerJobSchema>;

export const UpdateScheduleConfigSchema = z.object({
  cronExpression: z
    .string()
    .min(5, 'Cron expression too short')
    .max(100, 'Cron expression too long')
    .refine((val) => CRON_REGEX.test(val.trim()), {
      message: 'Invalid standard 5-part cron expression (e.g. "0 0 1 * *" or "*/15 * * * *")',
    })
    .optional(),
  isEnabled: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

export type UpdateScheduleConfigInput = z.infer<typeof UpdateScheduleConfigSchema>;

export const JobExecutionFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  jobType: z.nativeEnum(JobType).optional(),
  status: z.nativeEnum(JobExecutionStatus).optional(),
  queueName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().max(100).optional(),
});

export type JobExecutionFilterInput = z.infer<typeof JobExecutionFilterSchema>;

export const QueueControlSchema = z.object({
  queueName: z
    .enum(['propertyos:jobs', 'propertyos:notifications', 'propertyos:dlq'], {
      errorMap: () => ({ message: 'Invalid queue name. Must be propertyos:jobs, propertyos:notifications, or propertyos:dlq' }),
    })
    .default('propertyos:jobs'),
  action: z.enum(['pause', 'resume', 'clean'], {
    errorMap: () => ({ message: 'Action must be pause, resume, or clean' }),
  }),
  gracePeriodMs: z.coerce.number().int().min(0).default(5000).optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(1000).optional(),
});

export type QueueControlInput = z.infer<typeof QueueControlSchema>;
