import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ActionContext } from '../../common/types/action-context.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AllergySeverity, AllergyType } from '../../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { AllergyQueryDto } from './dto/allergy-query.dto.js';
import type { CreateAllergyDto } from './dto/create-allergy.dto.js';
import type { UpdateAllergyDto } from './dto/update-allergy.dto.js';

const allergySelect = {
  id: true,
  patientId: true,
  medicalRecordId: true,
  recordedByUserId: true,
  type: true,
  allergenName: true,
  reaction: true,
  severity: true,
  recordedAt: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

@Injectable()
export class AllergiesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAllForPatient(patientId: string, query: AllergyQueryDto) {
    await this.ensureActivePatient(this.prisma, patientId);
    const where: Prisma.AllergyWhereInput = {
      patientId,
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.search
        ? {
            OR: [
              { allergenName: { contains: query.search, mode: 'insensitive' } },
              { reaction: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.allergy.findMany({
        where,
        select: {
          ...allergySelect,
          recordedByUser: { select: { id: true, fullName: true } },
        },
        orderBy: [{ severity: 'desc' }, { recordedAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.allergy.count({ where }),
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
    const allergy = await this.prisma.allergy.findFirst({
      where: { id, deletedAt: null, patient: { deletedAt: null } },
      select: {
        ...allergySelect,
        patient: { select: { id: true, patientCode: true, fullName: true } },
        medicalRecord: { select: { id: true, title: true, recordedAt: true } },
        recordedByUser: { select: { id: true, fullName: true } },
      },
    });
    if (!allergy) throw new NotFoundException('Không tìm thấy thông tin dị ứng.');
    return allergy;
  }

  async create(patientId: string, dto: CreateAllergyDto, context: ActionContext) {
    const recordedAt = this.parseRecordedAt(dto.recordedAt) ?? new Date();

    return this.prisma.$transaction(async (transaction) => {
      await this.ensureActivePatient(transaction, patientId);
      await this.ensureMedicalRecord(transaction, dto.medicalRecordId, patientId);
      const allergy = await transaction.allergy.create({
        data: {
          patientId,
          medicalRecordId: dto.medicalRecordId,
          recordedByUserId: context.actorUserId,
          type: dto.type,
          allergenName: dto.allergenName,
          reaction: dto.reaction,
          severity: dto.severity,
          recordedAt,
          note: dto.note,
        },
        select: allergySelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'ALLERGY_CREATED',
          entityType: 'ALLERGY',
          entityId: allergy.id,
          newValues: this.toAuditSnapshot(allergy),
        },
        transaction,
      );
      return allergy;
    });
  }

  async update(id: string, dto: UpdateAllergyDto, context: ActionContext) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để cập nhật.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const current = await this.findActiveInTransaction(transaction, id);
      const type = dto.type ?? current.type;
      await this.ensureMedicalRecord(transaction, dto.medicalRecordId, current.patientId);
      const allergy = await transaction.allergy.update({
        where: { id },
        data: {
          medicalRecordId: dto.medicalRecordId,
          type,
          allergenName: dto.allergenName,
          reaction: dto.reaction,
          severity: dto.severity,
          recordedAt:
            dto.recordedAt === undefined ? undefined : this.parseRecordedAt(dto.recordedAt),
          note: dto.note,
        },
        select: allergySelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'ALLERGY_UPDATED',
          entityType: 'ALLERGY',
          entityId: id,
          oldValues: this.toAuditSnapshot(current),
          newValues: this.toAuditSnapshot(allergy),
        },
        transaction,
      );
      return allergy;
    });
  }

  async softDelete(id: string, context: ActionContext) {
    return this.prisma.$transaction(async (transaction) => {
      await this.findActiveInTransaction(transaction, id);
      const allergy = await transaction.allergy.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: allergySelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'ALLERGY_DELETED',
          entityType: 'ALLERGY',
          entityId: id,
          oldValues: { deletedAt: null },
          newValues: { deletedAt: allergy.deletedAt?.toISOString() ?? null },
        },
        transaction,
      );
      return allergy;
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

  private async ensureMedicalRecord(
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
    const allergy = await transaction.allergy.findFirst({
      where: { id, deletedAt: null, patient: { deletedAt: null } },
      select: allergySelect,
    });
    if (!allergy) throw new NotFoundException('Không tìm thấy thông tin dị ứng.');
    return allergy;
  }

  private parseRecordedAt(value: string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const parsed = new Date(value);
    if (parsed.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException('Thời điểm ghi nhận không được nằm trong tương lai.');
    }
    return parsed;
  }

  private toAuditSnapshot(allergy: {
    patientId: string;
    medicalRecordId: string | null;
    recordedByUserId: string;
    type: AllergyType;
    allergenName: string;
    reaction: string | null;
    severity: AllergySeverity;
    recordedAt: Date;
    note: string | null;
  }): Prisma.InputJsonValue {
    return {
      patientId: allergy.patientId,
      medicalRecordId: allergy.medicalRecordId,
      recordedByUserId: allergy.recordedByUserId,
      type: allergy.type,
      allergenName: allergy.allergenName,
      reaction: allergy.reaction,
      severity: allergy.severity,
      recordedAt: allergy.recordedAt.toISOString(),
      note: allergy.note,
    };
  }
}
