import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ActionContext } from '../../common/types/action-context.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { CreateMedicalRecordDto } from './dto/create-medical-record.dto.js';
import type { MedicalRecordQueryDto } from './dto/medical-record-query.dto.js';
import type { UpdateMedicalRecordDto } from './dto/update-medical-record.dto.js';
import { medicalRecordAttachmentSelect } from './medical-record-attachments.service.js';

const medicalRecordSelect = {
  id: true,
  patientId: true,
  recordedByUserId: true,
  recordedAt: true,
  title: true,
  chiefComplaint: true,
  clinicalNotes: true,
  vitalSigns: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  attachments: {
    select: medicalRecordAttachmentSelect,
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

@Injectable()
export class MedicalRecordsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAllForPatient(patientId: string, query: MedicalRecordQueryDto) {
    await this.ensureActivePatient(this.prisma, patientId);
    const recordedAt = this.buildDateRange(query.from, query.to);
    const where: Prisma.MedicalRecordWhereInput = {
      patientId,
      deletedAt: null,
      ...(query.recordedByUserId ? { recordedByUserId: query.recordedByUserId } : {}),
      ...(recordedAt ? { recordedAt } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { chiefComplaint: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.medicalRecord.findMany({
        where,
        select: {
          ...medicalRecordSelect,
          recordedByUser: { select: { id: true, fullName: true } },
        },
        orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.medicalRecord.count({ where }),
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
    const record = await this.prisma.medicalRecord.findFirst({
      where: { id, deletedAt: null, patient: { deletedAt: null } },
      select: {
        ...medicalRecordSelect,
        patient: { select: { id: true, patientCode: true, fullName: true } },
        recordedByUser: { select: { id: true, fullName: true } },
        _count: { select: { patientDiseases: true, allergies: true } },
      },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ y tế.');
    return record;
  }

  async create(patientId: string, dto: CreateMedicalRecordDto, context: ActionContext) {
    const recordedAt = this.parseRecordedAt(dto.recordedAt) ?? new Date();

    return this.prisma.$transaction(async (transaction) => {
      await this.ensureActivePatient(transaction, patientId);
      const record = await transaction.medicalRecord.create({
        data: {
          patientId,
          recordedByUserId: context.actorUserId,
          recordedAt,
          title: dto.title,
          chiefComplaint: dto.chiefComplaint,
          clinicalNotes: dto.clinicalNotes ?? '',
          vitalSigns: this.toJsonInput(dto.vitalSigns),
        },
        select: medicalRecordSelect,
      });

      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'MEDICAL_RECORD_CREATED',
          entityType: 'MEDICAL_RECORD',
          entityId: record.id,
          newValues: this.toAuditSnapshot(record),
        },
        transaction,
      );
      return record;
    });
  }

  async update(id: string, dto: UpdateMedicalRecordDto, context: ActionContext) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để cập nhật.');
    }
    const recordedAt =
      dto.recordedAt === undefined ? undefined : this.parseRecordedAt(dto.recordedAt);

    return this.prisma.$transaction(async (transaction) => {
      const current = await this.findActiveInTransaction(transaction, id);
      const record = await transaction.medicalRecord.update({
        where: { id },
        data: {
          recordedAt,
          title: dto.title,
          chiefComplaint: dto.chiefComplaint,
          clinicalNotes: dto.clinicalNotes,
          vitalSigns: this.toJsonInput(dto.vitalSigns),
        },
        select: medicalRecordSelect,
      });

      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'MEDICAL_RECORD_UPDATED',
          entityType: 'MEDICAL_RECORD',
          entityId: id,
          oldValues: this.toAuditSnapshot(current),
          newValues: this.toAuditSnapshot(record),
        },
        transaction,
      );
      return record;
    });
  }

  async softDelete(id: string, context: ActionContext) {
    return this.prisma.$transaction(async (transaction) => {
      await this.findActiveInTransaction(transaction, id);
      const [diseases, allergies] = await Promise.all([
        transaction.patientDisease.count({ where: { medicalRecordId: id, deletedAt: null } }),
        transaction.allergy.count({ where: { medicalRecordId: id, deletedAt: null } }),
      ]);
      if (diseases + allergies > 0) {
        throw new ConflictException(
          'Không thể xóa hồ sơ y tế khi còn bệnh lý hoặc dị ứng liên quan.',
        );
      }
      const record = await transaction.medicalRecord.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: medicalRecordSelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'MEDICAL_RECORD_DELETED',
          entityType: 'MEDICAL_RECORD',
          entityId: id,
          oldValues: { deletedAt: null },
          newValues: { deletedAt: record.deletedAt?.toISOString() ?? null },
        },
        transaction,
      );
      return record;
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

  private async findActiveInTransaction(transaction: Prisma.TransactionClient, id: string) {
    const record = await transaction.medicalRecord.findFirst({
      where: { id, deletedAt: null, patient: { deletedAt: null } },
      select: medicalRecordSelect,
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ y tế.');
    return record;
  }

  private parseRecordedAt(value: string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const parsed = new Date(value);
    if (parsed.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException('Thời điểm ghi nhận không được nằm trong tương lai.');
    }
    return parsed;
  }

  private buildDateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('Thời điểm bắt đầu phải trước thời điểm kết thúc.');
    }
    return { gte: fromDate, lte: toDate };
  }

  private toJsonInput(
    value: Record<string, unknown> | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.DbNull;
    return value as Prisma.InputJsonValue;
  }

  private toAuditSnapshot(record: {
    patientId: string;
    recordedByUserId: string;
    recordedAt: Date;
    title: string | null;
    chiefComplaint: string | null;
    clinicalNotes: string;
    vitalSigns: Prisma.JsonValue;
  }): Prisma.InputJsonValue {
    return {
      patientId: record.patientId,
      recordedByUserId: record.recordedByUserId,
      recordedAt: record.recordedAt.toISOString(),
      title: record.title,
      chiefComplaint: record.chiefComplaint,
      clinicalNotes: record.clinicalNotes,
      vitalSigns: record.vitalSigns,
    };
  }
}
