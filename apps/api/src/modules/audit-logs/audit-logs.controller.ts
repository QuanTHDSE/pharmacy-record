import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { AuditLogsService } from './audit-logs.service.js';
import { AuditLogQueryDto } from './dto/audit-log-query.dto.js';

@ApiTags('Audit logs')
@ApiBearerAuth()
@ApiExtraModels(AuditLogQueryDto)
@Roles(UserRole.ADMIN)
@Controller({ path: 'audit-logs', version: '1' })
export class AuditLogsController {
  constructor(@Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm, lọc và phân trang audit log (chỉ ADMIN)' })
  @ApiOkResponse({ description: 'Danh sách audit log theo thứ tự mới nhất.' })
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get('filter-options')
  @ApiOperation({ summary: 'Lấy danh sách action và entityType hiện có' })
  @ApiOkResponse({ description: 'Các giá trị dùng để xây dựng bộ lọc.' })
  findFilterOptions() {
    return this.auditLogsService.findFilterOptions();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết một audit log' })
  @ApiParam({ name: 'id', type: String, example: '1' })
  @ApiOkResponse({ description: 'Chi tiết dữ liệu trước/sau của sự kiện.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy audit log.' })
  findOne(@Param('id', ParseBigIntPipe) id: bigint) {
    return this.auditLogsService.findOne(id);
  }
}
