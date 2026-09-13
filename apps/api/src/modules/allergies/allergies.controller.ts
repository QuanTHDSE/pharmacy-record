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
import { AllergiesService } from './allergies.service.js';
import { AllergyQueryDto } from './dto/allergy-query.dto.js';
import { CreateAllergyDto } from './dto/create-allergy.dto.js';
import { UpdateAllergyDto } from './dto/update-allergy.dto.js';

function actionContext(request: RequestWithUser): ActionContext {
  return {
    actorUserId: request.user.id,
    ipAddress: request.ip,
    requestId: request.requestId,
    userAgent: request.get('user-agent'),
  };
}

@ApiTags('Allergies')
@ApiBearerAuth()
@ApiExtraModels(AllergyQueryDto)
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller({ path: 'patients/:patientId/allergies', version: '1' })
export class PatientAllergiesController {
  constructor(@Inject(AllergiesService) private readonly allergiesService: AllergiesService) {}

  @Get()
  @ApiOperation({ summary: 'Liệt kê dị ứng của bệnh nhân' })
  findAll(@Param('patientId', ParseUUIDPipe) patientId: string, @Query() query: AllergyQueryDto) {
    return this.allergiesService.findAllForPatient(patientId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Ghi nhận dị ứng cho bệnh nhân' })
  @ApiBody({ type: CreateAllergyDto })
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateAllergyDto,
    @Req() request: RequestWithUser,
  ) {
    return this.allergiesService.create(patientId, dto, actionContext(request));
  }
}

@ApiTags('Allergies')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller({ path: 'allergies', version: '1' })
export class AllergiesController {
  constructor(@Inject(AllergiesService) private readonly allergiesService: AllergiesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết dị ứng' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.allergiesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin dị ứng' })
  @ApiBody({ type: UpdateAllergyDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAllergyDto,
    @Req() request: RequestWithUser,
  ) {
    return this.allergiesService.update(id, dto, actionContext(request));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa mềm dị ứng (chỉ ADMIN)' })
  softDelete(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithUser) {
    return this.allergiesService.softDelete(id, actionContext(request));
  }
}
