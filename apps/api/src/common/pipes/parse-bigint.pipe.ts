import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    if (!/^[1-9]\d*$/.test(value)) {
      throw new BadRequestException('ID audit log phải là số nguyên dương.');
    }

    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException('ID audit log không hợp lệ.');
    }
  }
}
