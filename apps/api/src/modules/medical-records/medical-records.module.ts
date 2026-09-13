import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import {
  MedicalRecordsController,
  PatientMedicalRecordsController,
} from './medical-records.controller.js';
import { MedicalRecordAttachmentsService } from './medical-record-attachments.service.js';
import { MedicalRecordsService } from './medical-records.service.js';

@Module({
  imports: [AuditLogsModule],
  controllers: [PatientMedicalRecordsController, MedicalRecordsController],
  providers: [MedicalRecordsService, MedicalRecordAttachmentsService],
  exports: [MedicalRecordsService, MedicalRecordAttachmentsService],
})
export class MedicalRecordsModule {}
