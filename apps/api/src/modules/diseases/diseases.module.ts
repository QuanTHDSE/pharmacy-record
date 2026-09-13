import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { DiseasesController } from './diseases.controller.js';
import { DiseasesService } from './diseases.service.js';

@Module({
  imports: [AuditLogsModule],
  controllers: [DiseasesController],
  providers: [DiseasesService],
  exports: [DiseasesService],
})
export class DiseasesModule {}
