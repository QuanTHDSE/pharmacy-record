import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Gender } from '../../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { MedicalRecordAttachmentsService } from '../medical-records/medical-record-attachments.service.js';
import type { CreatePatientDto } from './dto/create-patient.dto.js';
import type { PatientQueryDto } from './dto/patient-query.dto.js';
import type { UpdatePatientDto } from './dto/update-patient.dto.js';

const patientSelect = {
  id: true,
  patientCode: true,
  fullName: true,
  dateOfBirth: true,
  gender: true,
  phone: true,
  address: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export interface PatientActionContext {
  actorUserId: string;
  ipAddress?: string;
  requestId?: string;
  userAgent?: string;
}

@Injectable()
export class PatientsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService,
    @Inject(MedicalRecordAttachmentsService)
    private readonly medicalRecordAttachmentsService: MedicalRecordAttachmentsService,
  ) {}

  findAll(query: PatientQueryDto) {
    return this.findPage(query, { equals: null });
  }

  findDeleted(query: PatientQueryDto) {
    return this.findPage(query, { not: null });
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...patientSelect,
        _count: {
          select: {
            medicalRecords: { where: { deletedAt: null } },
            patientDiseases: { where: { deletedAt: null } },
            allergies: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!patient) throw new NotFoundException('Không tìm thấy bệnh nhân.');
    return patient;
  }

  async create(dto: CreatePatientDto, context: PatientActionContext) {
    const dateOfBirth = this.parseDateOfBirth(dto.dateOfBirth);

    return this.prisma.$transaction(async (transaction) => {
      const patientCode = await this.generatePatientCode(transaction);
      const patient = await transaction.patient.create({
        data: {
          patientCode,
          fullName: dto.fullName,
          dateOfBirth,
          gender: dto.gender,
          phone: dto.phone,
          address: dto.address,
          note: dto.note,
        },
        select: patientSelect,
      });

      await this.auditLogsService.recordPatientManagementEvent(
        {
          ...context,
          action: 'PATIENT_CREATED',
          entityId: patient.id,
          newValues: this.toAuditSnapshot(patient),
        },
        transaction,
      );

      return patient;
    });
  }

  async update(id: string, dto: UpdatePatientDto, context: PatientActionContext) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để cập nhật.');
    }

    const dateOfBirth =
      dto.dateOfBirth === undefined ? undefined : this.parseDateOfBirth(dto.dateOfBirth);

    return this.prisma.$transaction(async (transaction) => {
      const current = await this.findActiveInTransaction(transaction, id);
      const patient = await transaction.patient.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          dateOfBirth,
          gender: dto.gender,
          phone: dto.phone,
          address: dto.address,
          note: dto.note,
        },
        select: patientSelect,
      });

      await this.auditLogsService.recordPatientManagementEvent(
        {
          ...context,
          action: 'PATIENT_UPDATED',
          entityId: id,
          oldValues: this.toAuditSnapshot(current),
          newValues: this.toAuditSnapshot(patient),
        },
        transaction,
      );

      return patient;
    });
  }

  async softDelete(id: string, context: PatientActionContext) {
    return this.prisma.$transaction(async (transaction) => {
      await this.findActiveInTransaction(transaction, id);
      const patient = await transaction.patient.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: patientSelect,
      });

      await this.auditLogsService.recordPatientManagementEvent(
        {
          ...context,
          action: 'PATIENT_DELETED',
          entityId: id,
          oldValues: { deletedAt: null },
          newValues: { deletedAt: patient.deletedAt?.toISOString() ?? null },
        },
        transaction,
      );

      return patient;
    });
  }

  async restore(id: string, context: PatientActionContext) {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.patient.findFirst({
        where: { id, deletedAt: { not: null } },
        select: patientSelect,
      });
      if (!current) throw new NotFoundException('Không tìm thấy bệnh nhân đã xóa.');

      const patient = await transaction.patient.update({
        where: { id },
        data: { deletedAt: null },
        select: patientSelect,
      });

      await this.auditLogsService.recordPatientManagementEvent(
        {
          ...context,
          action: 'PATIENT_RESTORED',
          entityId: id,
          oldValues: { deletedAt: current.deletedAt?.toISOString() ?? null },
          newValues: { deletedAt: null },
        },
        transaction,
      );

      return patient;
    });
  }

  async permanentlyDelete(id: string, context: PatientActionContext) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const patient = await transaction.patient.findFirst({
        where: { id, deletedAt: { not: null } },
        select: {
          ...patientSelect,
          medicalRecords: {
            select: {
              id: true,
              attachments: { select: { storageKey: true } },
            },
          },
        },
      });
      if (!patient) throw new NotFoundException('Không tìm thấy bệnh nhân đã xóa.');

      const medicalRecordIds = patient.medicalRecords.map((record) => record.id);
      const attachmentStorageKeys = patient.medicalRecords.flatMap((record) =>
        record.attachments.map((attachment) => attachment.storageKey),
      );

      const deletedAllergies = await transaction.allergy.deleteMany({ where: { patientId: id } });
      const deletedPatientDiseases = await transaction.patientDisease.deleteMany({
        where: { patientId: id },
      });
      const deletedAttachments = await transaction.medicalRecordAttachment.deleteMany({
        where: { medicalRecordId: { in: medicalRecordIds } },
      });
      const deletedMedicalRecords = await transaction.medicalRecord.deleteMany({
        where: { patientId: id },
      });
      await transaction.patient.delete({ where: { id } });

      await this.auditLogsService.recordPatientManagementEvent(
        {
          ...context,
          action: 'PATIENT_PERMANENTLY_DELETED',
          entityId: id,
          oldValues: {
            patient: this.toAuditSnapshot(patient),
            deletedAt: patient.deletedAt?.toISOString() ?? null,
            relatedDataCounts: {
              allergies: deletedAllergies.count,
              patientDiseases: deletedPatientDiseases.count,
              medicalRecords: deletedMedicalRecords.count,
              attachments: deletedAttachments.count,
            },
          },
        },
        transaction,
      );

      return {
        attachmentStorageKeys,
        patient: {
          id: patient.id,
          patientCode: patient.patientCode,
          fullName: patient.fullName,
          deletedPermanently: true,
        },
      };
    });

    await this.medicalRecordAttachmentsService.removeStoredFiles(result.attachmentStorageKeys);
    return result.patient;
  }

  private async findPage(
    query: PatientQueryDto,
    deletedAt: Prisma.DateTimeNullableFilter<'Patient'>,
  ) {
    const where = this.buildWhere(query, deletedAt);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        select: patientSelect,
        orderBy: [{ createdAt: 'desc' }, { fullName: 'asc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.patient.count({ where }),
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

  private buildWhere(
    query: PatientQueryDto,
    deletedAt: Prisma.DateTimeNullableFilter<'Patient'>,
  ): Prisma.PatientWhereInput {
    return {
      deletedAt,
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.patientCode ? { patientCode: { contains: query.patientCode } } : {}),
      ...(query.fullName ? { fullName: { contains: query.fullName, mode: 'insensitive' } } : {}),
      ...(query.phone ? { phone: { contains: query.phone } } : {}),
      ...(query.search
        ? {
            OR: [
              { patientCode: { contains: query.search.toUpperCase() } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };
  }

  private async findActiveInTransaction(transaction: Prisma.TransactionClient, id: string) {
    const patient = await transaction.patient.findFirst({
      where: { id, deletedAt: null },
      select: patientSelect,
    });
    if (!patient) throw new NotFoundException('Không tìm thấy bệnh nhân.');
    return patient;
  }

  private async generatePatientCode(transaction: Prisma.TransactionClient): Promise<string> {
    const [sequence] = await transaction.$queryRaw<Array<{ nextValue: bigint }>>`
      SELECT nextval('patients_patient_code_seq') AS "nextValue"
    `;

    if (!sequence) {
      throw new Error('Không thể tạo mã bệnh nhân.');
    }

    return `BN-${sequence.nextValue.toString().padStart(6, '0')}`;
  }

  private parseDateOfBirth(value: string | null | undefined): Date | null | undefined {
    if (value === null || value === undefined) return value;

    const parsed = new Date(`${value}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value ||
      parsed > today
    ) {
      throw new BadRequestException('Ngày sinh không hợp lệ hoặc nằm trong tương lai.');
    }

    return parsed;
  }

  private toAuditSnapshot(patient: {
    patientCode: string;
    fullName: string;
    dateOfBirth: Date | null;
    gender: Gender | null;
    phone: string | null;
    address: string | null;
    note: string | null;
  }): Prisma.InputJsonValue {
    return {
      patientCode: patient.patientCode,
      fullName: patient.fullName,
      dateOfBirth: patient.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address,
      note: patient.note,
    };
  }
}
