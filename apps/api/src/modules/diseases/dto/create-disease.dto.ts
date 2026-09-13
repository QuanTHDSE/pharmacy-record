import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDiseaseDto {
  @ApiPropertyOptional({ example: 'I10', maxLength: 30, nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,29}$/, { message: 'Mã bệnh lý không hợp lệ.' })
  @IsOptional()
  code?: string | null;

  @ApiProperty({ example: 'Tăng huyết áp' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive = true;
}
