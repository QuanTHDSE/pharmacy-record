import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import type { RequestWithId } from '../../common/types/request-with-id.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthenticatedUserDto, LoginResponseDto } from './dto/login-response.dto.js';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập bằng email và mật khẩu' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Thông tin đăng nhập không hợp lệ.' })
  @ApiTooManyRequestsResponse({ description: 'Vượt quá 5 lần thử trong một phút.' })
  login(@Body() credentials: LoginDto, @Req() request: RequestWithId) {
    return this.authService.login(credentials, {
      ipAddress: request.ip,
      requestId: request.requestId,
      userAgent: request.get('user-agent'),
    });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy người dùng đang đăng nhập' })
  @ApiOkResponse({ type: AuthenticatedUserDto })
  @ApiUnauthorizedResponse({ description: 'Access token thiếu, hết hạn hoặc không hợp lệ.' })
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
