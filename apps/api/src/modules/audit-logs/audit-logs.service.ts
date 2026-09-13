import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto.js';

const auditLogSelect = {
  id: true,
  actorUserId: true,
  action: true,
  entityType: true,
  entityId: true,
  oldValues: true,
  newValues: true,
  metadata: true,
  ipAddress: true,
  userAgent: true,
  requestId: true,
  occurredAt: true,
  actorUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  },
} as const;

export interface AuthenticationAuditEvent {
  action: 'AUTH_LOGIN_SUCCEEDED' | 'AUTH_LOGIN_FAILED';
  actorUserId?: string;
  ipAddress?: string;
  requestId?: string;
  userAgent?: string;
  reason?: 'INVALID_CREDENTIALS' | 'INACTIVE_USER';
}

export interface UserManagementAuditEvent {
  action: 'USER_CREATED' | 'USER_UPDATED' | 'USER_STATUS_CHANGED' | 'USER_PASSWORD_RESET';
  actorUserId: string;
  entityId: string;
  ipAddress?: string;
  requestId?: string;
  userAgent?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
}

export interface PatientManagementAuditEvent {
  action:
    | 'PATIENT_CREATED'
    | 'PATIENT_UPDATED'
    | 'PATIENT_DELETED'
    | 'PATIENT_RESTORED'
    | 'PATIENT_PERMANENTLY_DELETED';
  actorUserId: string;
  entityId: string;
  ipAddress?: string;
  requestId?: string;
  userAgent?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
}

export interface DataChangeAuditEvent {
  action: string;
  entityType: 'MEDICAL_RECORD' | 'DISEASE' | 'PATIENT_DISEASE' | 'ALLERGY';
  actorUserId: string;
  entityId: string;
  ipAddress?: string;
  requestId?: string;
  userAgent?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditLogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(query: AuditLogQueryDto) {
    const occurredAt = this.buildDateRange(query.from, query.to);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.requestId ? { requestId: query.requestId } : {}),
      ...(query.ipAddress ? { ipAddress: query.ipAddress } : {}),
      ...(occurredAt ? { occurredAt } : {}),
      ...(query.search
        ? {
            OR: [
              { action: { contains: query.search, mode: 'insensitive' } },
              { entityType: { contains: query.search, mode: 'insensitive' } },
              { userAgent: { contains: query.search, mode: 'insensitive' } },
              {
                actorUser: {
                  is: {
                    OR: [
                      { fullName: { contains: query.search, mode: 'insensitive' } },
                      { email: { contains: query.search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: auditLogSelect,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serialize(item)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: bigint) {
    const item = await this.prisma.auditLog.findUnique({
      where: { id },
      select: auditLogSelect,
    });
    if (!item) throw new NotFoundException('Không tìm thấy audit log.');
    return this.serialize(item);
  }

  async findFilterOptions() {
    const [actions, entityTypes] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        select: { entityType: true },
        distinct: ['entityType'],
        orderBy: { entityType: 'asc' },
      }),
    ]);

    return {
      actions: actions.map((item) => item.action),
      entityTypes: entityTypes.map((item) => item.entityType),
    };
  }

  async recordAuthenticationEvent(event: AuthenticationAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: 'AUTHENTICATION',
        entityId: event.actorUserId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        requestId: event.requestId,
        metadata: event.reason ? { reason: event.reason } : undefined,
      },
    });
  }

  async recordUserManagementEvent(
    event: UserManagementAuditEvent,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = transaction ?? this.prisma;

    await client.auditLog.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: 'USER',
        entityId: event.entityId,
        oldValues: this.sanitizeJson(event.oldValues),
        newValues: this.sanitizeJson(event.newValues),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        requestId: event.requestId,
      },
    });
  }

  async recordPatientManagementEvent(
    event: PatientManagementAuditEvent,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = transaction ?? this.prisma;

    await client.auditLog.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: 'PATIENT',
        entityId: event.entityId,
        oldValues: this.sanitizeJson(event.oldValues),
        newValues: this.sanitizeJson(event.newValues),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        requestId: event.requestId,
      },
    });
  }

  async recordDataChangeEvent(
    event: DataChangeAuditEvent,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = transaction ?? this.prisma;

    await client.auditLog.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        oldValues: this.sanitizeJson(event.oldValues),
        newValues: this.sanitizeJson(event.newValues),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        requestId: event.requestId,
      },
    });
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

  private serialize<T extends { id: bigint }>(item: T): Omit<T, 'id'> & { id: string } {
    return {
      ...item,
      id: item.id.toString(),
    };
  }

  private sanitizeJson(
    value: Prisma.InputJsonValue | undefined,
  ): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeJson(item) ?? null);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /password|token|secret|authorization|cookie/i.test(key)
          ? '[REDACTED]'
          : (this.sanitizeJson(item) ?? null),
      ]),
    );
  }
}
