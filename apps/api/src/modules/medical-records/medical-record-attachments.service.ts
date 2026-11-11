import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
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
  private readonly storageBackend: Environment['STORAGE_BACKEND'];
  private readonly storageBucket: string;
  private readonly supabase: SupabaseClient | null;
  private readonly r2: S3Client | null;
  private readonly r2Bucket: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    const configuredRoot = config.get('UPLOAD_DIR', { infer: true });
    this.uploadRoot = resolve(process.cwd(), configuredRoot);
    this.maxImageBytes = config.get('MAX_IMAGE_UPLOAD_BYTES', { infer: true });
    this.storageBackend = config.get('STORAGE_BACKEND', { infer: true });
    this.storageBucket = config.get('SUPABASE_STORAGE_BUCKET', { infer: true });
    const supabaseUrl = config.get('SUPABASE_URL', { infer: true });
    const supabaseKey = config.get('SUPABASE_SECRET_KEY', { infer: true });
    this.supabase =
      this.storageBackend === 'supabase' && supabaseUrl && supabaseKey
        ? createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          })
        : null;

    // Cloudflare R2 dùng API tương thích S3; region luôn là "auto".
    this.r2Bucket = config.get('R2_BUCKET', { infer: true }) ?? '';
    if (this.storageBackend === 'r2') {
      const accountId = config.get('R2_ACCOUNT_ID', { infer: true });
      const endpoint =
        config.get('R2_ENDPOINT', { infer: true }) ?? `https://${accountId}.r2.cloudflarestorage.com`;
      this.r2 = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: config.get('R2_ACCESS_KEY_ID', { infer: true })!,
          secretAccessKey: config.get('R2_SECRET_ACCESS_KEY', { infer: true })!,
        },
      });
    } else {
      this.r2 = null;
    }
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
    const storedKeys: string[] = [];

    try {
      for (const image of prepared) {
        await this.storeImage(image);
        storedKeys.push(image.storageKey);
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
      await this.removeStoredFiles(storedKeys);
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

    return { attachment, buffer: await this.readStoredFile(attachment.storageKey) };
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
          await this.deleteStoredFile(storageKey);
        } catch (error) {
          const code = error instanceof Error && 'code' in error ? String(error.code) : undefined;
          if (code !== 'ENOENT')
            this.logger.warn(
              `Không thể xóa tệp ${storageKey}: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`,
            );
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

  private async storeImage(image: PreparedImage): Promise<void> {
    const absolutePath = this.resolveStorageKey(image.storageKey);
    if (this.storageBackend === 'local') {
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, image.buffer, { flag: 'wx' });
      return;
    }

    if (this.storageBackend === 'r2') {
      try {
        await this.r2!.send(
          new PutObjectCommand({
            Bucket: this.r2Bucket,
            Key: image.storageKey,
            Body: image.buffer,
            ContentType: image.mimeType,
          }),
        );
      } catch (error) {
        this.logger.error(
          `Không thể tải ảnh ${image.storageKey} lên Cloudflare R2: ${describeError(error)}`,
        );
        throw new ServiceUnavailableException('Không thể lưu ảnh vào kho lưu trữ.');
      }
      return;
    }

    const { error } = await this.supabase!.storage.from(this.storageBucket).upload(
      image.storageKey,
      image.buffer,
      { contentType: image.mimeType, upsert: false },
    );
    if (error) {
      this.logger.error(
        `Không thể tải ảnh ${image.storageKey} lên Supabase Storage: ${error.message}`,
      );
      throw new ServiceUnavailableException('Không thể lưu ảnh vào kho lưu trữ.');
    }
  }

  private async readStoredFile(storageKey: string): Promise<Buffer> {
    const absolutePath = this.resolveStorageKey(storageKey);
    if (this.storageBackend === 'local') {
      try {
        return await readFile(absolutePath);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          throw new NotFoundException('Tệp ảnh không còn tồn tại trong kho lưu trữ.');
        }
        throw error;
      }
    }

    if (this.storageBackend === 'r2') {
      try {
        const object = await this.r2!.send(
          new GetObjectCommand({ Bucket: this.r2Bucket, Key: storageKey }),
        );
        if (!object.Body) throw new Error('Không có dữ liệu');
        return Buffer.from(await object.Body.transformToByteArray());
      } catch (error) {
        if (isNotFound(error)) {
          throw new NotFoundException('Tệp ảnh không còn tồn tại trong kho lưu trữ.');
        }
        this.logger.error(`Không thể đọc ảnh ${storageKey} từ Cloudflare R2: ${describeError(error)}`);
        throw new ServiceUnavailableException('Không thể đọc ảnh từ kho lưu trữ.');
      }
    }

    const { data, error } = await this.supabase!.storage.from(this.storageBucket).download(
      storageKey,
    );
    if (error || !data) {
      if (error?.statusCode === '404') {
        throw new NotFoundException('Tệp ảnh không còn tồn tại trong kho lưu trữ.');
      }
      this.logger.error(
        `Không thể đọc ảnh ${storageKey} từ Supabase Storage: ${error?.message ?? 'Không có dữ liệu'}`,
      );
      throw new ServiceUnavailableException('Không thể đọc ảnh từ kho lưu trữ.');
    }
    return Buffer.from(await data.arrayBuffer());
  }

  private async deleteStoredFile(storageKey: string): Promise<void> {
    const absolutePath = this.resolveStorageKey(storageKey);
    if (this.storageBackend === 'local') {
      await unlink(absolutePath);
      return;
    }
    if (this.storageBackend === 'r2') {
      // S3/R2 trả về thành công kể cả khi object không tồn tại.
      await this.r2!.send(new DeleteObjectCommand({ Bucket: this.r2Bucket, Key: storageKey }));
      return;
    }
    const { error } = await this.supabase!.storage.from(this.storageBucket).remove([storageKey]);
    if (error) throw error;
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

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return 'Lỗi không xác định';
}

function isNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return error.name === 'NoSuchKey' || error.name === 'NotFound' || status === 404;
}
