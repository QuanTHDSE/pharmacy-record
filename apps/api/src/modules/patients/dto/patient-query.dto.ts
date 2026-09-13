import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { Gender } from '../../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class PatientQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tìm đồng thời theo mã, họ tên hoặc số điện thoại' })
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MaxLength(30)
  @IsOptional()
  patientCode?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;
}
