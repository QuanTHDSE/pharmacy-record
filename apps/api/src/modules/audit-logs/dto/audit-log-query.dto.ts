import { Transform } from 'class-transformer';
import { IsIP, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Tìm trong hành động, loại thực thể, người dùng hoặc user agent',
  })
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 'PATIENT_UPDATED', maxLength: 100 })
  @Transform(uppercase)
  @Matches(/^[A-Z][A-Z0-9_]{1,99}$/, { message: 'action không hợp lệ.' })
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ example: 'PATIENT', maxLength: 100 })
  @Transform(uppercase)
  @Matches(/^[A-Z][A-Z0-9_]{1,99}$/, { message: 'entityType không hợp lệ.' })
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  actorUserId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  requestId?: string;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsIP()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @IsOptional()
  to?: string;
}
