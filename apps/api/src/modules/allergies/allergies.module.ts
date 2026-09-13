import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { AllergiesController, PatientAllergiesController } from './allergies.controller.js';
import { AllergiesService } from './allergies.service.js';

@Module({
  imports: [AuditLogsModule],
  controllers: [PatientAllergiesController, AllergiesController],
  providers: [AllergiesService],
  exports: [AllergiesService],
})
export class AllergiesModule {}
