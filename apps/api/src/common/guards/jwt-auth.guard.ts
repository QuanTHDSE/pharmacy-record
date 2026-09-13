import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { Environment } from '../../config/environment.js';
import { UsersService } from '../../modules/users/users.service.js';
import type { RequestWithUser } from '../types/request-with-user.js';

interface AccessTokenPayload {
  sub?: unknown;
  type?: unknown;
  ver?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Thiếu access token.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_SECRET', { infer: true }),
        issuer: this.config.get('JWT_ISSUER', { infer: true }),
        audience: this.config.get('JWT_AUDIENCE', { infer: true }),
      });

      if (typeof payload.sub !== 'string' || payload.type !== 'access') {
        throw new UnauthorizedException('Access token không hợp lệ.');
      }

      const user = await this.usersService.findActiveById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
      }

      if (typeof payload.ver !== 'number' || payload.ver !== user.tokenVersion) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi.');
      }

      request.user = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Access token hết hạn hoặc không hợp lệ.');
    }
  }

  private extractBearerToken(authorization: string | undefined): string | undefined {
    if (!authorization) return undefined;

    const [scheme, token, extra] = authorization.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra) return undefined;

    return token;
  }
}
