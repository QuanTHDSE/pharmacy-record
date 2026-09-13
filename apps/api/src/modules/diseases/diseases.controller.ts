import {
  Body,
  Controller,
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { ActionContext } from '../../common/types/action-context.js';
import type { RequestWithUser } from '../../common/types/request-with-user.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { DiseasesService } from './diseases.service.js';
import { CreateDiseaseDto } from './dto/create-disease.dto.js';
import { DiseaseQueryDto } from './dto/disease-query.dto.js';
import { SetDiseaseStatusDto } from './dto/set-disease-status.dto.js';
import { UpdateDiseaseDto } from './dto/update-disease.dto.js';

function actionContext(request: RequestWithUser): ActionContext {
  return {
    actorUserId: request.user.id,
    ipAddress: request.ip,
    requestId: request.requestId,
    userAgent: request.get('user-agent'),
  };
}

@ApiTags('Diseases')
@ApiBearerAuth()
@ApiExtraModels(DiseaseQueryDto)
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller({ path: 'diseases', version: '1' })
export class DiseasesController {
  constructor(@Inject(DiseasesService) private readonly diseasesService: DiseasesService) {}

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm danh mục bệnh lý' })
  findAll(@Query() query: DiseaseQueryDto) {
    return this.diseasesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết bệnh lý' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy bệnh lý.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.diseasesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo bệnh lý trong danh mục (chỉ ADMIN)' })
  @ApiBody({ type: CreateDiseaseDto })
  @ApiCreatedResponse({ description: 'Đã tạo bệnh lý.' })
  @ApiConflictResponse({ description: 'Mã hoặc tên bệnh lý đã tồn tại.' })
  create(@Body() dto: CreateDiseaseDto, @Req() request: RequestWithUser) {
    return this.diseasesService.create(dto, actionContext(request));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật bệnh lý (chỉ ADMIN)' })
  @ApiBody({ type: UpdateDiseaseDto })
  @ApiConflictResponse({ description: 'Mã hoặc tên bệnh lý đã tồn tại.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiseaseDto,
    @Req() request: RequestWithUser,
  ) {
    return this.diseasesService.update(id, dto, actionContext(request));
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Kích hoạt hoặc ngừng sử dụng bệnh lý (chỉ ADMIN)' })
  @ApiBody({ type: SetDiseaseStatusDto })
  @ApiOkResponse({ description: 'Đã cập nhật trạng thái bệnh lý.' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDiseaseStatusDto,
    @Req() request: RequestWithUser,
  ) {
    return this.diseasesService.setStatus(id, dto, actionContext(request));
  }
}
