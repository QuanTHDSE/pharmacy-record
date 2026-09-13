import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export interface HealthResponse {
  status: 'ok';
  service: 'pharmacy-records-api';
  database: 'up';
  timestamp: string;
  uptimeSeconds: number;
}

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Không thể kết nối cơ sở dữ liệu.');
    }

    return {
      status: 'ok',
      service: 'pharmacy-records-api',
      database: 'up',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
