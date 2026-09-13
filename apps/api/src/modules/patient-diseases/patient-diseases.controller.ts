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
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { ActionContext } from '../../common/types/action-context.js';
import type { RequestWithUser } from '../../common/types/request-with-user.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { CreatePatientDiseaseDto } from './dto/create-patient-disease.dto.js';
import { PatientDiseaseQueryDto } from './dto/patient-disease-query.dto.js';
import { UpdatePatientDiseaseDto } from './dto/update-patient-disease.dto.js';
import { PatientDiseasesService } from './patient-diseases.service.js';

function actionContext(request: RequestWithUser): ActionContext {
  return {
    actorUserId: request.user.id,
    ipAddress: request.ip,
    requestId: request.requestId,
    userAgent: request.get('user-agent'),
  };
}

@ApiTags('Patient diseases')
@ApiBearerAuth()
@ApiExtraModels(PatientDiseaseQueryDto)
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller({ path: 'patients/:patientId/diseases', version: '1' })
export class PatientDiseaseListController {
  constructor(
    @Inject(PatientDiseasesService)
    private readonly patientDiseasesService: PatientDiseasesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liệt kê bệnh lý của bệnh nhân' })
  findAll(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: PatientDiseaseQueryDto,
  ) {
    return this.patientDiseasesService.findAllForPatient(patientId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Ghi nhận bệnh lý cho bệnh nhân' })
  @ApiBody({ type: CreatePatientDiseaseDto })
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreatePatientDiseaseDto,
    @Req() request: RequestWithUser,
  ) {
    return this.patientDiseasesService.create(patientId, dto, actionContext(request));
  }
}

@ApiTags('Patient diseases')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller({ path: 'patient-diseases', version: '1' })
export class PatientDiseasesController {
  constructor(
    @Inject(PatientDiseasesService)
    private readonly patientDiseasesService: PatientDiseasesService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết bệnh lý của bệnh nhân' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientDiseasesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật tình trạng bệnh lý' })
  @ApiBody({ type: UpdatePatientDiseaseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDiseaseDto,
    @Req() request: RequestWithUser,
  ) {
    return this.patientDiseasesService.update(id, dto, actionContext(request));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa mềm bệnh lý của bệnh nhân (chỉ ADMIN)' })
  softDelete(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithUser) {
    return this.patientDiseasesService.softDelete(id, actionContext(request));
  }
}
