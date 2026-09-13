import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class MedicalRecordQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tìm trong tiêu đề, triệu chứng chính và ghi chú lâm sàng' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(150)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  recordedByUserId?: string;
}
