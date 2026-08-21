import { Module } from '@nestjs/common';
import { PgStructureService } from './pg-structure.service';
import { PgStructureController } from './pg-structure.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PgStructureController],
  providers: [PgStructureService],
  exports: [PgStructureService],
})
export class PgStructureModule {}
