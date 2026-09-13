import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import type { ActionContext } from '../../common/types/action-context.js';
import type { Environment } from '../../config/environment.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

export const medicalRecordAttachmentSelect = {
  id: true,
  medicalRecordId: true,
  uploadedByUserId: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  checksumSha256: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, fullName: true } },
} as const;

interface DetectedImageType {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: '.jpg' | '.png' | '.webp';
}

interface PreparedImage {
  originalName: string;
  storageKey: string;
  absolutePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  buffer: Buffer;
}

@Injectable()
export class MedicalRecordAttachmentsService {
  private readonly logger = new Logger(MedicalRecordAttachmentsService.name);
  private readonly uploadRoot: string;
  private readonly maxImageBytes: number;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    const configuredRoot = config.get('UPLOAD_DIR', { infer: true });
    this.uploadRoot = resolve(process.cwd(), configuredRoot);
    this.maxImageBytes = config.get('MAX_IMAGE_UPLOAD_BYTES', { infer: true });
  }

  async findAll(recordId: string) {
    await this.ensureActiveRecord(this.prisma, recordId);
    return this.prisma.medicalRecordAttachment.findMany({
      where: { medicalRecordId: recordId },
      select: medicalRecordAttachmentSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(recordId: string, files: Express.Multer.File[], context: ActionContext) {
    if (!files.length) throw new BadRequestException('Cần chọn ít nhất một ảnh để tải lên.');
    await this.ensureActiveRecord(this.prisma, recordId);

    const currentCount = await this.prisma.medicalRecordAttachment.count({
      where: { medicalRecordId: recordId },
    });
    if (currentCount + files.length > 20) {
      throw new BadRequestException('Mỗi hồ sơ y tế được đính kèm tối đa 20 ảnh.');
    }

    const prepared = files.map((file) => this.prepareImage(recordId, file));
    await mkdir(resolve(this.uploadRoot, recordId), { recursive: true });

    try {
      for (const image of prepared) {
        await writeFile(image.absolutePath, image.buffer, { flag: 'wx' });
      }

      return await this.prisma.$transaction(async (transaction) => {
        const created = [];
        for (const image of prepared) {
          created.push(
            await transaction.medicalRecordAttachment.create({
              data: {
                medicalRecordId: recordId,
                uploadedByUserId: context.actorUserId,
                originalName: image.originalName,
                storageKey: image.storageKey,
                mimeType: image.mimeType,
                sizeBytes: image.sizeBytes,
                checksumSha256: image.checksumSha256,
              },
              select: medicalRecordAttachmentSelect,
            }),
          );
        }

        await this.auditLogsService.recordDataChangeEvent(
          {
            ...context,
            action: 'MEDICAL_RECORD_IMAGES_UPLOADED',
            entityType: 'MEDICAL_RECORD',
            entityId: recordId,
            newValues: {
              attachments: created.map((item) => ({
                id: item.id,
                originalName: item.originalName,
                mimeType: item.mimeType,
                sizeBytes: item.sizeBytes,
              })),
            },
          },
          transaction,
        );
        return created;
      });
    } catch (error) {
      await Promise.allSettled(prepared.map((image) => unlink(image.absolutePath)));
      throw error;
    }
  }

  async read(recordId: string, attachmentId: string) {
    const attachment = await this.prisma.medicalRecordAttachment.findFirst({
      where: {
        id: attachmentId,
        medicalRecordId: recordId,
        medicalRecord: { deletedAt: null, patient: { deletedAt: null } },
      },
    });
    if (!attachment) throw new NotFoundException('Không tìm thấy ảnh đính kèm.');

    const absolutePath = this.resolveStorageKey(attachment.storageKey);
    try {
      return { attachment, buffer: await readFile(absolutePath) };
    } catch {
      throw new NotFoundException('Tệp ảnh không còn tồn tại trong kho lưu trữ.');
    }
  }

  async remove(recordId: string, attachmentId: string, context: ActionContext) {
    const attachment = await this.prisma.medicalRecordAttachment.findFirst({
      where: {
        id: attachmentId,
        medicalRecordId: recordId,
        medicalRecord: { deletedAt: null, patient: { deletedAt: null } },
      },
    });
    if (!attachment) throw new NotFoundException('Không tìm thấy ảnh đính kèm.');

    await this.prisma.$transaction(async (transaction) => {
      await transaction.medicalRecordAttachment.delete({ where: { id: attachmentId } });
      await this.auditLogsService.recordDataChangeEvent(
        {
          ...context,
          action: 'MEDICAL_RECORD_IMAGE_DELETED',
          entityType: 'MEDICAL_RECORD',
          entityId: recordId,
          oldValues: {
            attachment: {
              id: attachment.id,
              originalName: attachment.originalName,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
            },
          },
        },
        transaction,
      );
    });

    await this.removeStoredFiles([attachment.storageKey]);

    return {
      id: attachment.id,
      medicalRecordId: attachment.medicalRecordId,
      originalName: attachment.originalName,
    };
  }

  async removeStoredFiles(storageKeys: string[]): Promise<void> {
    await Promise.all(
      storageKeys.map(async (storageKey) => {
        try {
          await unlink(this.resolveStorageKey(storageKey));
        } catch (error) {
          const code = error instanceof Error && 'code' in error ? String(error.code) : undefined;
          if (code !== 'ENOENT') this.logger.warn(`Không thể xóa tệp ${storageKey}.`);
        }
      }),
    );
  }

  private prepareImage(recordId: string, file: Express.Multer.File): PreparedImage {
    const detectedType = this.detectImageType(file.buffer);
    if (!detectedType) {
      throw new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP hợp lệ.');
    }
    if (file.size <= 0 || file.size > this.maxImageBytes) {
      throw new BadRequestException(
        `Mỗi ảnh phải nhỏ hơn hoặc bằng ${Math.floor(this.maxImageBytes / 1_048_576)} MB.`,
      );
    }

    const storedName = `${randomUUID()}${detectedType.extension}`;
    const storageKey = `${recordId}/${storedName}`;
    return {
      originalName: this.safeOriginalName(file.originalname),
      storageKey,
      absolutePath: this.resolveStorageKey(storageKey),
      mimeType: detectedType.mimeType,
      sizeBytes: file.size,
      checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
      buffer: file.buffer,
    };
  }

  private safeOriginalName(value: string): string {
    const safe = Array.from(basename(value))
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim();
    return (safe || 'medical-image').slice(0, 255);
  }

  private resolveStorageKey(storageKey: string): string {
    const absolutePath = resolve(this.uploadRoot, storageKey);
    const relativePath = relative(this.uploadRoot, absolutePath);
    if (relativePath.startsWith(`..${sep}`) || relativePath === '..' || isAbsolute(relativePath)) {
      throw new BadRequestException('Đường dẫn lưu trữ không hợp lệ.');
    }
    return absolutePath;
  }

  private detectImageType(buffer: Buffer): DetectedImageType | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mimeType: 'image/jpeg', extension: '.jpg' };
    }

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(png)) {
      return { mimeType: 'image/png', extension: '.png' };
    }

    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return { mimeType: 'image/webp', extension: '.webp' };
    }

    return null;
  }

  private async ensureActiveRecord(
    client: Prisma.TransactionClient | PrismaService,
    recordId: string,
  ): Promise<void> {
    const record = await client.medicalRecord.findFirst({
      where: { id: recordId, deletedAt: null, patient: { deletedAt: null } },
      select: { id: true },
    });
    if (!record) throw new NotFoundException('Không tìm thấy hồ sơ y tế.');
  }
}
