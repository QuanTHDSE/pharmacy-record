import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AllergySeverity, AllergyType } from '../../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAllergyDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  medicalRecordId?: string | null;

  @ApiPropertyOptional({ enum: AllergyType, default: AllergyType.OTHER })
  @IsEnum(AllergyType)
  @IsOptional()
  type = AllergyType.OTHER;

  @ApiProperty({ example: 'Penicillin', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  allergenName!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  reaction?: string | null;

  @ApiPropertyOptional({ enum: AllergySeverity, default: AllergySeverity.UNKNOWN })
  @IsEnum(AllergySeverity)
  @IsOptional()
  severity = AllergySeverity.UNKNOWN;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsISO8601({ strict: true })
  @IsOptional()
  recordedAt?: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  note?: string | null;
}
