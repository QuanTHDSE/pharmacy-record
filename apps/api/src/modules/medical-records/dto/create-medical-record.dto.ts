import { Transform } from 'class-transformer';
import { IsISO8601, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateMedicalRecordDto {
  @ApiPropertyOptional({ example: '2026-09-11T08:30:00+07:00' })
  @IsISO8601({ strict: true })
  @IsOptional()
  recordedAt?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    nullable: true,
    example: 'Tái khám tăng huyết áp',
  })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  chiefComplaint?: string | null;

  @ApiPropertyOptional({ maxLength: 20_000 })
  @Transform(trim)
  @IsString()
  @MaxLength(20_000)
  @IsOptional()
  clinicalNotes?: string;

  @ApiPropertyOptional({ type: Object, nullable: true, example: { bloodPressure: '120/80' } })
  @IsObject()
  @IsOptional()
  vitalSigns?: Record<string, unknown> | null;
}
