import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashPassword } from '../../common/security/password.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';
import type { SetUserStatusDto } from './dto/set-user-status.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserQueryDto } from './dto/user-query.dto.js';

const safeUserSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface UserActionContext {
  actorUserId: string;
  ipAddress?: string;
  requestId?: string;
  userAgent?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService,
  ) {}

  findByEmailForAuthentication(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        ...safeUserSelect,
        passwordHash: true,
        tokenVersion: true,
      },
    });
  }

  async findActiveById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...safeUserSelect,
        tokenVersion: true,
      },
    });

    return user?.isActive ? user : null;
  }

  async findAll(query: UserQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: [{ fullName: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
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
    const user = await this.prisma.user.findUnique({ where: { id }, select: safeUserSelect });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
    return user;
  }

  async create(dto: CreateUserDto, context: UserActionContext) {
    const passwordHash = await hashPassword(dto.password);

    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          passwordHash,
          role: dto.role,
          isActive: dto.isActive,
        },
        select: safeUserSelect,
      });

      await this.auditLogsService.recordUserManagementEvent(
        {
          ...context,
          action: 'USER_CREATED',
          entityId: user.id,
          newValues: this.toAuditSnapshot(user),
        },
        transaction,
      );

      return user;
    });
  }

  async update(id: string, dto: UpdateUserDto, context: UserActionContext) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để cập nhật.');
    }

    return this.runSerializable(async (transaction) => {
      const current = await this.findOneInTransaction(transaction, id);

      if (id === context.actorUserId && dto.role && dto.role !== UserRole.ADMIN) {
        throw new BadRequestException('Bạn không thể tự hạ quyền tài khoản đang đăng nhập.');
      }

      if (
        current.role === UserRole.ADMIN &&
        current.isActive &&
        dto.role !== undefined &&
        dto.role !== UserRole.ADMIN
      ) {
        await this.ensureAnotherActiveAdmin(transaction, id);
      }

      const user = await transaction.user.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          email: dto.email,
          role: dto.role,
        },
        select: safeUserSelect,
      });

      await this.auditLogsService.recordUserManagementEvent(
        {
          ...context,
          action: 'USER_UPDATED',
          entityId: id,
          oldValues: this.toAuditSnapshot(current),
          newValues: this.toAuditSnapshot(user),
        },
        transaction,
      );

      return user;
    });
  }

  async setStatus(id: string, dto: SetUserStatusDto, context: UserActionContext) {
    return this.runSerializable(async (transaction) => {
      const current = await this.findOneInTransaction(transaction, id);

      if (id === context.actorUserId && !dto.isActive) {
        throw new BadRequestException('Bạn không thể tự vô hiệu hóa tài khoản đang đăng nhập.');
      }

      if (current.role === UserRole.ADMIN && current.isActive && !dto.isActive) {
        await this.ensureAnotherActiveAdmin(transaction, id);
      }

      if (current.isActive === dto.isActive) return current;

      const user = await transaction.user.update({
        where: { id },
        data: { isActive: dto.isActive },
        select: safeUserSelect,
      });

      await this.auditLogsService.recordUserManagementEvent(
        {
          ...context,
          action: 'USER_STATUS_CHANGED',
          entityId: id,
          oldValues: { isActive: current.isActive },
          newValues: { isActive: user.isActive },
        },
        transaction,
      );

      return user;
    });
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto, context: UserActionContext) {
    const passwordHash = await hashPassword(dto.newPassword);

    return this.prisma.$transaction(async (transaction) => {
      await this.findOneInTransaction(transaction, id);
      const user = await transaction.user.update({
        where: { id },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
        select: safeUserSelect,
      });

      await this.auditLogsService.recordUserManagementEvent(
        {
          ...context,
          action: 'USER_PASSWORD_RESET',
          entityId: id,
          newValues: { sessionsRevoked: true },
        },
        transaction,
      );

      return user;
    });
  }

  private async findOneInTransaction(transaction: Prisma.TransactionClient, id: string) {
    const user = await transaction.user.findUnique({ where: { id }, select: safeUserSelect });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
    return user;
  }

  private async ensureAnotherActiveAdmin(
    transaction: Prisma.TransactionClient,
    excludedUserId: string,
  ): Promise<void> {
    const otherActiveAdmins = await transaction.user.count({
      where: {
        id: { not: excludedUserId },
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    if (otherActiveAdmins === 0) {
      throw new BadRequestException('Hệ thống phải luôn có ít nhất một ADMIN đang hoạt động.');
    }
  }

  private async runSerializable<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: 'Serializable' });
      } catch (error) {
        const isWriteConflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!isWriteConflict) throw error;
        if (attempt === 3) {
          throw new ConflictException('Dữ liệu vừa được thay đổi. Vui lòng thử lại.');
        }
      }
    }

    throw new ConflictException('Dữ liệu vừa được thay đổi. Vui lòng thử lại.');
  }

  private toAuditSnapshot(user: {
    fullName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  }): Prisma.InputJsonValue {
    return {
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
