import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobsRedisProvider } from './jobs-redis.provider';
import { JobsService } from './jobs.service';
import { JobsWorkerService } from './jobs-worker.service';
import { JobsController } from './jobs.controller';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, NotificationsModule],
  controllers: [JobsController],
  providers: [JobsRedisProvider, JobsService, JobsWorkerService],
  exports: [JobsService, JobsWorkerService, JobsRedisProvider],
})
export class JobsModule {}
