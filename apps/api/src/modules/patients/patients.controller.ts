import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { RequestWithUser } from '../../common/types/request-with-user.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { CreatePatientDto } from './dto/create-patient.dto.js';
import { PatientQueryDto } from './dto/patient-query.dto.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';
import { PatientsService, type PatientActionContext } from './patients.service.js';

@ApiTags('Patients')
@ApiBearerAuth()
@ApiExtraModels(PatientQueryDto)
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(@Inject(PatientsService) private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm và phân trang bệnh nhân đang hoạt động' })
  @ApiOkResponse({ description: 'Tìm theo mã bệnh nhân, họ tên hoặc số điện thoại.' })
  findAll(@Query() query: PatientQueryDto) {
    return this.patientsService.findAll(query);
  }

  @Get('deleted')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Liệt kê bệnh nhân đã xóa (chỉ ADMIN)' })
  @ApiOkResponse({ description: 'Danh sách bệnh nhân đã xóa mềm.' })
  findDeleted(@Query() query: PatientQueryDto) {
    return this.patientsService.findDeleted(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết bệnh nhân' })
  @ApiOkResponse({ description: 'Thông tin bệnh nhân và số lượng hồ sơ liên quan.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy bệnh nhân.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo bệnh nhân' })
  @ApiBody({ type: CreatePatientDto })
  @ApiCreatedResponse({ description: 'Đã tạo bệnh nhân với mã được sinh tự động.' })
  create(@Body() dto: CreatePatientDto, @Req() request: RequestWithUser) {
    return this.patientsService.create(dto, this.actionContext(request));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật bệnh nhân' })
  @ApiBody({ type: UpdatePatientDto })
  @ApiOkResponse({ description: 'Đã cập nhật bệnh nhân.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy bệnh nhân.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
    @Req() request: RequestWithUser,
  ) {
    return this.patientsService.update(id, dto, this.actionContext(request));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa mềm bệnh nhân (chỉ ADMIN)' })
  @ApiOkResponse({ description: 'Bệnh nhân đã được đánh dấu là đã xóa.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy bệnh nhân.' })
  softDelete(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithUser) {
    return this.patientsService.softDelete(id, this.actionContext(request));
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Khôi phục bệnh nhân đã xóa (chỉ ADMIN)' })
  @ApiOkResponse({ description: 'Đã khôi phục bệnh nhân.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy bệnh nhân đã xóa.' })
  restore(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithUser) {
    return this.patientsService.restore(id, this.actionContext(request));
  }

  @Delete(':id/permanent')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa vĩnh viễn bệnh nhân đã xóa (chỉ ADMIN)' })
  @ApiOkResponse({ description: 'Đã xóa bệnh nhân và toàn bộ dữ liệu liên quan.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy bệnh nhân đã xóa.' })
  permanentlyDelete(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithUser) {
    return this.patientsService.permanentlyDelete(id, this.actionContext(request));
  }

  private actionContext(request: RequestWithUser): PatientActionContext {
    return {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      requestId: request.requestId,
      userAgent: request.get('user-agent'),
    };
  }
}
