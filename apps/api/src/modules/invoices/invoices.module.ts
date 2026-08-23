import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoiceNumberService } from './invoice-number.service';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [PrismaModule, AuthModule, LedgerModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceNumberService],
  exports: [InvoicesService, InvoiceNumberService],
})
export class InvoicesModule {}
