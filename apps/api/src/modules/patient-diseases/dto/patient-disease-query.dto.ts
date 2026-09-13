import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { DiseaseStatus } from '../../../generated/prisma/enums.js';

export class PatientDiseaseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo mã hoặc tên bệnh lý' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: DiseaseStatus })
  @IsEnum(DiseaseStatus)
  @IsOptional()
  status?: DiseaseStatus;
}
