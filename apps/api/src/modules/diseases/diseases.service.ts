import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ActionContext } from '../../common/types/action-context.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { CreateDiseaseDto } from './dto/create-disease.dto.js';
import type { DiseaseQueryDto } from './dto/disease-query.dto.js';
import type { SetDiseaseStatusDto } from './dto/set-disease-status.dto.js';
import type { UpdateDiseaseDto } from './dto/update-disease.dto.js';

const diseaseSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class DiseasesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService,
  ) {}
  async findAll(query: DiseaseQueryDto) {
    const where: Prisma.DiseaseWhereInput = {
      isActive: query.isActive,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search.toUpperCase() } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.disease.findMany({
        where,
        select: diseaseSelect,
        orderBy: { name: 'asc' },
        skip,
        take: query.limit,
      }),
      this.prisma.disease.count({ where }),
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
    const disease = await this.prisma.disease.findUnique({
      where: { id },
      select: {
        ...diseaseSelect,
        _count: { select: { patientDiseases: { where: { deletedAt: null } } } },
      },
    });
    if (!disease) throw new NotFoundException('Không tìm thấy bệnh lý.');
    return disease;
  }

  async create(dto: CreateDiseaseDto, context: ActionContext) {
    return this.prisma.$transaction(async (transaction) => {
      const disease = await transaction.disease.create({
        data: dto,
        select: diseaseSelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'DISEASE_CREATED',
          entityType: 'DISEASE',
          entityId: disease.id,
          newValues: this.toAuditSnapshot(disease),
        },
        transaction,
      );
      return disease;
    });
  }

  async update(id: string, dto: UpdateDiseaseDto, context: ActionContext) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để cập nhật.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.disease.findUnique({
        where: { id },
        select: diseaseSelect,
      });
      if (!current) throw new NotFoundException('Không tìm thấy bệnh lý.');
      const disease = await transaction.disease.update({
        where: { id },
        data: dto,
        select: diseaseSelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'DISEASE_UPDATED',
          entityType: 'DISEASE',
          entityId: id,
          oldValues: this.toAuditSnapshot(current),
          newValues: this.toAuditSnapshot(disease),
        },
        transaction,
      );
      return disease;
    });
  }

  async setStatus(id: string, dto: SetDiseaseStatusDto, context: ActionContext) {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.disease.findUnique({
        where: { id },
        select: diseaseSelect,
      });
      if (!current) throw new NotFoundException('Không tìm thấy bệnh lý.');
      if (current.isActive === dto.isActive) return current;
      const disease = await transaction.disease.update({
        where: { id },
        data: { isActive: dto.isActive },
        select: diseaseSelect,
      });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'DISEASE_STATUS_CHANGED',
          entityType: 'DISEASE',
          entityId: id,
          oldValues: { isActive: current.isActive },
          newValues: { isActive: disease.isActive },
        },
        transaction,
      );
      return disease;
    });
  }

  private toAuditSnapshot(disease: {
    code: string | null;
    name: string;
    description: string | null;
    isActive: boolean;
  }): Prisma.InputJsonValue {
    return {
      code: disease.code,
      name: disease.name,
      description: disease.description,
      isActive: disease.isActive,
    };
  }
}
