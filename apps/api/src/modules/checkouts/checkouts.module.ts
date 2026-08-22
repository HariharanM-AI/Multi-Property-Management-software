import { Module } from '@nestjs/common';
import { CheckoutsController } from './checkouts.controller';
import { CheckoutsService } from './checkouts.service';
import { SettlementService } from './settlement.service';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CheckoutsController],
  providers: [CheckoutsService, SettlementService],
  exports: [CheckoutsService, SettlementService],
})
export class CheckoutsModule {}
