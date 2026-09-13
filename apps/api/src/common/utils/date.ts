import { BadRequestException } from '@nestjs/common';

export function parseDateOnly(value: string | null | undefined, fieldName: string) {
  if (value === null || value === undefined) return value;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${fieldName} không phải là ngày hợp lệ.`);
  }
  return parsed;
}

export function parseDateTime(value: string | null | undefined, fieldName: string) {
  if (value === null || value === undefined) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${fieldName} không phải là thời điểm hợp lệ.`);
  }
  return parsed;
}
