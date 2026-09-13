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
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { ActionContext } from '../../common/types/action-context.js';
import type { RequestWithUser } from '../../common/types/request-with-user.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto.js';
import { MedicalRecordQueryDto } from './dto/medical-record-query.dto.js';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto.js';
import { MedicalRecordAttachmentsService } from './medical-record-attachments.service.js';
import { MedicalRecordsService } from './medical-records.service.js';

function actionContext(request: RequestWithUser): ActionContext {
  return {
    actorUserId: request.user.id,
    ipAddress: request.ip,
    requestId: request.requestId,
    userAgent: request.get('user-agent'),
  };
}

@ApiTags('Medical records')
@ApiBearerAuth()
@ApiExtraModels(MedicalRecordQueryDto)
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller({ path: 'patients/:patientId/medical-records', version: '1' })
export class PatientMedicalRecordsController {
  constructor(
    @Inject(MedicalRecordsService) private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liệt kê hồ sơ y tế của bệnh nhân' })
  findAll(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: MedicalRecordQueryDto,
  ) {
    return this.medicalRecordsService.findAllForPatient(patientId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo hồ sơ y tế cho bệnh nhân' })
  @ApiBody({ type: CreateMedicalRecordDto })
  @ApiCreatedResponse({ description: 'Đã tạo hồ sơ y tế.' })
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateMedicalRecordDto,
    @Req() request: RequestWithUser,
  ) {
    return this.medicalRecordsService.create(patientId, dto, actionContext(request));
  }
}

@ApiTags('Medical records')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller({ path: 'medical-records', version: '1' })
export class MedicalRecordsController {
  constructor(
    @Inject(MedicalRecordsService) private readonly medicalRecordsService: MedicalRecordsService,
    @Inject(MedicalRecordAttachmentsService)
    private readonly attachmentsService: MedicalRecordAttachmentsService,
  ) {}

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Liệt kê ảnh đính kèm của hồ sơ y tế' })
  findAttachments(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.findAll(id);
  }

  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải ảnh vào hồ sơ y tế (tối đa 10 ảnh/lần)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { files: 10, fileSize: 20_971_520 },
    }),
  )
  uploadAttachments(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() request: RequestWithUser,
  ) {
    return this.attachmentsService.upload(id, files ?? [], actionContext(request));
  }

  @Get(':id/attachments/:attachmentId')
  @ApiOperation({ summary: 'Xem hoặc tải một ảnh hồ sơ có xác thực' })
  async getAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const { attachment, buffer } = await this.attachmentsService.read(id, attachmentId);
    const encodedName = encodeURIComponent(attachment.originalName);
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Length', String(buffer.length));
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(buffer);
  }

  @Delete(':id/attachments/:attachmentId')
  @ApiOperation({ summary: 'Xóa một ảnh khỏi hồ sơ y tế' })
  removeAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: RequestWithUser,
  ) {
    return this.attachmentsService.remove(id, attachmentId, actionContext(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết hồ sơ y tế' })
  @ApiOkResponse({ description: 'Hồ sơ y tế cùng bệnh nhân và người ghi nhận.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy hồ sơ y tế.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật hồ sơ y tế' })
  @ApiBody({ type: UpdateMedicalRecordDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicalRecordDto,
    @Req() request: RequestWithUser,
  ) {
    return this.medicalRecordsService.update(id, dto, actionContext(request));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa mềm hồ sơ y tế (chỉ ADMIN)' })
  softDelete(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithUser) {
    return this.medicalRecordsService.softDelete(id, actionContext(request));
  }
}
