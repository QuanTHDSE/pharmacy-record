import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import {
  PatientDiseaseListController,
  PatientDiseasesController,
} from './patient-diseases.controller.js';
import { PatientDiseasesService } from './patient-diseases.service.js';

@Module({
  imports: [AuditLogsModule],
  controllers: [PatientDiseaseListController, PatientDiseasesController],
  providers: [PatientDiseasesService],
  exports: [PatientDiseasesService],
})
export class PatientDiseasesModule {}
