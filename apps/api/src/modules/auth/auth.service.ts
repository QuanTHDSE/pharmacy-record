import { randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../../common/security/password.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import type { Environment } from '../../config/environment.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto } from './dto/login.dto.js';

interface LoginContext {
  ipAddress?: string;
  requestId?: string;
  userAgent?: string;
}

interface AccessTokenPayload {
  sub: string;
  type: 'access';
  jti: string;
  ver: number;
}

@Injectable()
export class AuthService {
  private readonly invalidPasswordHash = hashPassword('not-a-real-user-password');

  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(AuditLogsService) private readonly auditLogsService: AuditLogsService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  async login(credentials: LoginDto, context: LoginContext) {
    const email = credentials.email.trim().toLowerCase();
    const user = await this.usersService.findByEmailForAuthentication(email);
    const passwordMatches = await verifyPassword(
      user?.passwordHash ?? (await this.invalidPasswordHash),
      credentials.password,
    );

    if (!user || !passwordMatches) {
      await this.auditLogsService.recordAuthenticationEvent({
        ...context,
        action: 'AUTH_LOGIN_FAILED',
        reason: 'INVALID_CREDENTIALS',
      });
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    if (!user.isActive) {
      await this.auditLogsService.recordAuthenticationEvent({
        ...context,
        action: 'AUTH_LOGIN_FAILED',
        actorUserId: user.id,
        reason: 'INACTIVE_USER',
      });
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    const payload: AccessTokenPayload = {
      sub: user.id,
      type: 'access',
      jti: randomUUID(),
      ver: user.tokenVersion,
    };
    const expiresIn = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn,
      issuer: this.config.get('JWT_ISSUER', { infer: true }),
      audience: this.config.get('JWT_AUDIENCE', { infer: true }),
    });

    await this.auditLogsService.recordAuthenticationEvent({
      ...context,
      action: 'AUTH_LOGIN_SUCCEEDED',
      actorUserId: user.id,
    });

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken,
      tokenType: 'Bearer' as const,
      expiresIn,
      user: authenticatedUser,
    };
  }
}
