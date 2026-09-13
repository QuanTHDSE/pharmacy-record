import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdatePatientDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn An', maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '1990-05-20', nullable: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth phải có định dạng YYYY-MM-DD.' })
  @IsOptional()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ enum: Gender, nullable: true })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender | null;

  @ApiPropertyOptional({ example: '0901234567', maxLength: 20, nullable: true })
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9+().\s-]{7,20}$/, { message: 'Số điện thoại không hợp lệ.' })
  @IsOptional()
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  address?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  note?: string | null;
}
