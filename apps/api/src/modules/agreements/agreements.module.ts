import { Module } from '@nestjs/common';
import { AgreementsController } from './agreements.controller';
import { AgreementsService } from './agreements.service';
import { AgreementTemplateService } from './agreement-template.service';
import { AgreementRendererService } from './agreement-renderer.service';
import { AgreementPdfService } from './agreement-pdf.service';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [AgreementsController],
  providers: [
    AgreementsService,
    AgreementTemplateService,
    AgreementRendererService,
    AgreementPdfService,
  ],
  exports: [
    AgreementsService,
    AgreementTemplateService,
    AgreementRendererService,
    AgreementPdfService,
  ],
})
export class AgreementsModule {}
