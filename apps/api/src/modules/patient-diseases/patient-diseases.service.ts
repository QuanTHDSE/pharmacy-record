import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ActionContext } from '../../common/types/action-context.js';
import { parseDateOnly } from '../../common/utils/date.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DiseaseStatus } from '../../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { CreatePatientDiseaseDto } from './dto/create-patient-disease.dto.js';
import type { PatientDiseaseQueryDto } from './dto/patient-disease-query.dto.js';
import type { UpdatePatientDiseaseDto } from './dto/update-patient-disease.dto.js';

const patientDiseaseSelect = {
  id: true,
  patientId: true,
  diseaseId: true,
  medicalRecordId: true,
  recordedByUserId: true,
  status: true,
  diagnosedAt: true,
  resolvedAt: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

@Injectable()
export class PatientDiseasesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAllForPatient(patientId: string, query: PatientDiseaseQueryDto) {
    await this.ensureActivePatient(this.prisma, patientId);
    const where: Prisma.PatientDiseaseWhereInput = {
      patientId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            disease: {
              OR: [
                { code: { contains: query.search.toUpperCase() } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.patientDisease.findMany({
        where,
        select: {
          ...patientDiseaseSelect,
          disease: { select: { id: true, code: true, name: true, isActive: true } },
          recordedByUser: { select: { id: true, fullName: true } },
        },
        orderBy: [{ status: 'asc' }, { diagnosedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.patientDisease.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.patientDisease.findFirst({
      where: { id, deletedAt: null, patient: { deletedAt: null } },
      select: {
        ...patientDiseaseSelect,
        patient: { select: { id: true, patientCode: true, fullName: true } },
        disease: { select: { id: true, code: true, name: true, isActive: true } },
        medicalRecord: { select: { id: true, title: true, recordedAt: true } },
        recordedByUser: { select: { id: true, fullName: true } },
      },
    });
    if (!item) throw new NotFoundException('Không tìm thấy bệnh lý của bệnh nhân.');
    return item;
  }

  async create(patientId: string, dto: CreatePatientDiseaseDto, context: ActionContext) {
    const diagnosedAt = parseDateOnly(dto.diagnosedAt, 'Ngày chẩn đoán');
    const resolvedAt = parseDateOnly(dto.resolvedAt, 'Ngày khỏi bệnh');
    this.validateState(dto.status, diagnosedAt, resolvedAt);

    return this.prisma.$transaction(async (transaction) => {
      await this.ensureActivePatient(transaction, patientId);
      await this.ensureActiveDisease(transaction, dto.diseaseId);
      await this.ensureMedicalRecordBelongsToPatient(transaction, dto.medicalRecordId, patientId);
      const item = await transaction.patientDisease.create({
        data: {
          patientId,
          diseaseId: dto.diseaseId,
          medicalRecordId: dto.medicalRecordId,
          recordedByUserId: context.actorUserId,
          status: dto.status,
          diagnosedAt,
          resolvedAt,
          note: dto.note,
        },
        select: patientDiseaseSelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'PATIENT_DISEASE_CREATED',
          entityType: 'PATIENT_DISEASE',
          entityId: item.id,
          newValues: this.toAuditSnapshot(item),
        },
        transaction,
      );
      return item;
    });
  }

  async update(id: string, dto: UpdatePatientDiseaseDto, context: ActionContext) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để cập nhật.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const current = await this.findActiveInTransaction(transaction, id);
      const diagnosedAt =
        dto.diagnosedAt === undefined
          ? current.diagnosedAt
          : parseDateOnly(dto.diagnosedAt, 'Ngày chẩn đoán');
      const resolvedAt =
        dto.resolvedAt === undefined
          ? current.resolvedAt
          : parseDateOnly(dto.resolvedAt, 'Ngày khỏi bệnh');
      const status = dto.status ?? current.status;
      this.validateState(status, diagnosedAt, resolvedAt);
      await this.ensureMedicalRecordBelongsToPatient(
        transaction,
        dto.medicalRecordId,
        current.patientId,
      );
      const item = await transaction.patientDisease.update({
        where: { id },
        data: {
          medicalRecordId: dto.medicalRecordId,
          status,
          diagnosedAt,
          resolvedAt,
          note: dto.note,
        },
        select: patientDiseaseSelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'PATIENT_DISEASE_UPDATED',
          entityType: 'PATIENT_DISEASE',
          entityId: id,
          oldValues: this.toAuditSnapshot(current),
          newValues: this.toAuditSnapshot(item),
        },
        transaction,
      );
      return item;
    });
  }

  async softDelete(id: string, context: ActionContext) {
    return this.prisma.$transaction(async (transaction) => {
      await this.findActiveInTransaction(transaction, id);
      const item = await transaction.patientDisease.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: patientDiseaseSelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'PATIENT_DISEASE_DELETED',
          entityType: 'PATIENT_DISEASE',
          entityId: id,
          oldValues: { deletedAt: null },
          newValues: { deletedAt: item.deletedAt?.toISOString() ?? null },
        },
        transaction,
      );
      return item;
    });
  }

  private async ensureActivePatient(
    client: Prisma.TransactionClient | PrismaService,
    patientId: string,
  ): Promise<void> {
    const patient = await client.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Không tìm thấy bệnh nhân.');
  }

  private async ensureActiveDisease(
    transaction: Prisma.TransactionClient,
    diseaseId: string,
  ): Promise<void> {
    const disease = await transaction.disease.findFirst({
      where: { id: diseaseId, isActive: true },
      select: { id: true },
    });
    if (!disease) throw new NotFoundException('Không tìm thấy bệnh lý đang hoạt động.');
  }

  private async ensureMedicalRecordBelongsToPatient(
    transaction: Prisma.TransactionClient,
    medicalRecordId: string | null | undefined,
    patientId: string,
  ): Promise<void> {
    if (!medicalRecordId) return;
    const record = await transaction.medicalRecord.findFirst({
      where: { id: medicalRecordId, patientId, deletedAt: null },
      select: { id: true },
    });
    if (!record) {
      throw new BadRequestException('Hồ sơ y tế không thuộc bệnh nhân hoặc đã bị xóa.');
    }
  }

  private async findActiveInTransaction(transaction: Prisma.TransactionClient, id: string) {
    const item = await transaction.patientDisease.findFirst({
      where: { id, deletedAt: null, patient: { deletedAt: null } },
      select: patientDiseaseSelect,
    });
    if (!item) throw new NotFoundException('Không tìm thấy bệnh lý của bệnh nhân.');
    return item;
  }

  private validateState(
    status: DiseaseStatus,
    diagnosedAt: Date | null | undefined,
    resolvedAt: Date | null | undefined,
  ): void {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if ((diagnosedAt && diagnosedAt > today) || (resolvedAt && resolvedAt > today)) {
      throw new BadRequestException('Ngày chẩn đoán hoặc ngày khỏi bệnh không được ở tương lai.');
    }
    if (diagnosedAt && resolvedAt && resolvedAt < diagnosedAt) {
      throw new BadRequestException('Ngày khỏi bệnh phải bằng hoặc sau ngày chẩn đoán.');
    }
    if (status === DiseaseStatus.RESOLVED && !resolvedAt) {
      throw new BadRequestException('Bệnh lý đã khỏi phải có ngày khỏi bệnh.');
    }
    if (status !== DiseaseStatus.RESOLVED && resolvedAt) {
      throw new BadRequestException('Chỉ bệnh lý đã khỏi mới có ngày khỏi bệnh.');
    }
  }

  private toAuditSnapshot(item: {
    patientId: string;
    diseaseId: string;
    medicalRecordId: string | null;
    recordedByUserId: string;
    status: DiseaseStatus;
    diagnosedAt: Date | null;
    resolvedAt: Date | null;
    note: string | null;
  }): Prisma.InputJsonValue {
    return {
      patientId: item.patientId,
      diseaseId: item.diseaseId,
      medicalRecordId: item.medicalRecordId,
      recordedByUserId: item.recordedByUserId,
      status: item.status,
      diagnosedAt: item.diagnosedAt?.toISOString().slice(0, 10) ?? null,
      resolvedAt: item.resolvedAt?.toISOString().slice(0, 10) ?? null,
      note: item.note,
    };
  }
}
