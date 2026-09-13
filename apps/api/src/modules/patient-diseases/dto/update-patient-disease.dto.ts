import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiseaseStatus } from '../../../generated/prisma/enums.js';

export class UpdatePatientDiseaseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  medicalRecordId?: string | null;

  @ApiPropertyOptional({ enum: DiseaseStatus })
  @IsEnum(DiseaseStatus)
  @IsOptional()
  status?: DiseaseStatus;

  @ApiPropertyOptional({ example: '2024-06-15', nullable: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'diagnosedAt phải có định dạng YYYY-MM-DD.' })
  @IsOptional()
  diagnosedAt?: string | null;

  @ApiPropertyOptional({ example: '2025-01-10', nullable: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'resolvedAt phải có định dạng YYYY-MM-DD.' })
  @IsOptional()
  resolvedAt?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  note?: string | null;
}
