import { Module } from '@nestjs/common';
import { SecurityDepositsService } from './security-deposits.service';
import { SecurityDepositsController } from './security-deposits.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SecurityDepositsController],
  providers: [SecurityDepositsService],
  exports: [SecurityDepositsService],
})
export class SecurityDepositsModule {}
