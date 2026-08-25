import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  TriggerJobSchema,
  UpdateScheduleConfigSchema,
  JobExecutionFilterSchema,
  QueueControlSchema,
  TriggerJobInput,
  UpdateScheduleConfigInput,
  JobExecutionFilterInput,
  QueueControlInput,
} from '@propertyos/validation';
import { AuthUser, Permission, JobType } from '@propertyos/types';

@Controller('jobs')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * 1. Get real-time queue stats and Redis engine health
   */
  @Get('stats')
  @RequirePermissions(Permission.JOB_READ)
  async getQueueStats() {
    return this.jobsService.getQueueStats();
  }

  /**
   * 2. List durable JobExecution records with filters and pagination
   */
  @Get('executions')
  @RequirePermissions(Permission.JOB_READ)
  async getExecutions(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(JobExecutionFilterSchema)) query: JobExecutionFilterInput,
  ) {
    return this.jobsService.getExecutions(user.organizationId, user, query);
  }

  /**
   * 3. Get single JobExecution record detail
   */
  @Get('executions/:id')
  @RequirePermissions(Permission.JOB_READ)
  async getExecutionById(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.jobsService.getExecutionById(user.organizationId, user, id);
  }

  /**
   * 4. Manually trigger a background job
   */
  @Post('trigger')
  @RequirePermissions(Permission.JOB_TRIGGER)
  async triggerJob(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(TriggerJobSchema)) input: TriggerJobInput,
  ) {
    return this.jobsService.triggerJob(user.organizationId, user, input);
  }

  /**
   * 5. Pause a BullMQ queue
   */
  @Post('pause')
  @RequirePermissions(Permission.JOB_MANAGE)
  async pauseQueue(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(QueueControlSchema)) input: QueueControlInput,
  ) {
    return this.jobsService.pauseQueue(user.organizationId, user, input.queueName);
  }

  /**
   * 6. Resume a paused BullMQ queue
   */
  @Post('resume')
  @RequirePermissions(Permission.JOB_MANAGE)
  async resumeQueue(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(QueueControlSchema)) input: QueueControlInput,
  ) {
    return this.jobsService.resumeQueue(user.organizationId, user, input.queueName);
  }

  /**
   * 7. Retry a failed job execution
   */
  @Post('retry/:id')
  @RequirePermissions(Permission.JOB_MANAGE)
  async retryExecution(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.jobsService.retryExecution(user.organizationId, user, id);
  }

  /**
   * 8. Clean completed/failed jobs from queue
   */
  @Post('clean')
  @RequirePermissions(Permission.JOB_MANAGE)
  async cleanQueue(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(QueueControlSchema)) input: QueueControlInput,
  ) {
    return this.jobsService.cleanQueue(
      user.organizationId,
      user,
      input.queueName,
      input.gracePeriodMs,
      input.limit,
    );
  }

  /**
   * 9. List scheduled job configurations for organization
   */
  @Get('schedules')
  @RequirePermissions(Permission.JOB_READ)
  async getSchedules(@CurrentUser() user: AuthUser) {
    return this.jobsService.getSchedules(user.organizationId, user);
  }

  /**
   * 10. Update scheduled job configuration (cron/enabled)
   */
  @Patch('schedules/:jobType')
  @RequirePermissions(Permission.JOB_MANAGE)
  async updateSchedule(
    @CurrentUser() user: AuthUser,
    @Param('jobType') jobType: JobType,
    @Body(new ZodValidationPipe(UpdateScheduleConfigSchema)) input: UpdateScheduleConfigInput,
  ) {
    return this.jobsService.updateSchedule(user.organizationId, user, jobType, input);
  }
}
