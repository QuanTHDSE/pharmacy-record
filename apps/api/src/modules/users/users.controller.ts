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
import type { RequestWithUser } from '../../common/types/request-with-user.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';
import { SetUserStatusDto } from './dto/set-user-status.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserQueryDto } from './dto/user-query.dto.js';
import { UsersService, type UserActionContext } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@ApiExtraModels(UserQueryDto)
@Roles(UserRole.ADMIN)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm, lọc và phân trang người dùng' })
  @ApiOkResponse({ description: 'Danh sách người dùng không bao gồm mật khẩu.' })
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết người dùng' })
  @ApiOkResponse({ description: 'Thông tin người dùng không bao gồm mật khẩu.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy người dùng.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo người dùng' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ description: 'Đã tạo người dùng.' })
  @ApiConflictResponse({ description: 'Email đã được sử dụng.' })
  create(@Body() dto: CreateUserDto, @Req() request: RequestWithUser) {
    return this.usersService.create(dto, this.actionContext(request));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật họ tên, email hoặc vai trò' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ description: 'Đã cập nhật người dùng.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy người dùng.' })
  @ApiConflictResponse({ description: 'Email đã được sử dụng.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: RequestWithUser,
  ) {
    return this.usersService.update(id, dto, this.actionContext(request));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Kích hoạt hoặc vô hiệu hóa người dùng' })
  @ApiBody({ type: SetUserStatusDto })
  @ApiOkResponse({ description: 'Đã cập nhật trạng thái người dùng.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy người dùng.' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @Req() request: RequestWithUser,
  ) {
    return this.usersService.setStatus(id, dto, this.actionContext(request));
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu và thu hồi các JWT cũ' })
  @ApiBody({ type: ResetUserPasswordDto })
  @ApiOkResponse({ description: 'Đã đặt lại mật khẩu.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy người dùng.' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
    @Req() request: RequestWithUser,
  ) {
    return this.usersService.resetPassword(id, dto, this.actionContext(request));
  }

  private actionContext(request: RequestWithUser): UserActionContext {
    return {
      actorUserId: request.user.id,
      ipAddress: request.ip,
      requestId: request.requestId,
      userAgent: request.get('user-agent'),
    };
  }
}
