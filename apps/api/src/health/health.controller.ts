import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { HealthService, type HealthResponse } from './health.service.js';

@ApiTags('Health')
@Public()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra trạng thái API và PostgreSQL' })
  @ApiOkResponse({ description: 'API và PostgreSQL đang hoạt động.' })
  getHealth(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
