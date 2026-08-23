import { Module } from '@nestjs/common';
import { ElectricityService } from './electricity.service';
import { ElectricityController } from './electricity.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [PrismaModule, AuthModule, InvoicesModule],
  controllers: [ElectricityController],
  providers: [ElectricityService],
  exports: [ElectricityService],
})
export class ElectricityModule {}
