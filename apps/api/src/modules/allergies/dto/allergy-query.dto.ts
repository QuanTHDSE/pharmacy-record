import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { AllergySeverity, AllergyType } from '../../../generated/prisma/enums.js';

export class AllergyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo tác nhân hoặc phản ứng dị ứng' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: AllergyType })
  @IsEnum(AllergyType)
  @IsOptional()
  type?: AllergyType;

  @ApiPropertyOptional({ enum: AllergySeverity })
  @IsEnum(AllergySeverity)
  @IsOptional()
  severity?: AllergySeverity;
}
