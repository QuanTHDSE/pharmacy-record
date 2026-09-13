import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateDiseaseDto {
  @ApiPropertyOptional({ example: 'I10', maxLength: 30, nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,29}$/, { message: 'Mã bệnh lý không hợp lệ.' })
  @IsOptional()
  code?: string | null;

  @ApiPropertyOptional({ example: 'Tăng huyết áp' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  description?: string | null;
}
