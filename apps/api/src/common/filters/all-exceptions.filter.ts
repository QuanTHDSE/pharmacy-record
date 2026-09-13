import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import type { ApiErrorBody, ApiErrorResponse } from '../interfaces/api-response.js';
import type { RequestWithId } from '../types/request-with-id.js';

interface ResolvedError {
  status: number;
  body: ApiErrorBody;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const resolved = this.resolveError(exception);

    if (resolved.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.originalUrl} requestId=${request.requestId}`,
        stack,
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      error: resolved.body,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.requestId,
        path: request.originalUrl,
      },
    };

    response.status(resolved.status).json(body);
  }

  private resolveError(exception: unknown): ResolvedError {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    if (exception instanceof HttpException) {
      return this.resolveHttpError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Đã xảy ra lỗi nội bộ.',
      },
    };
  }

  private resolvePrismaError(exception: Prisma.PrismaClientKnownRequestError): ResolvedError {
    const errors: Record<string, ResolvedError> = {
      P2002: {
        status: HttpStatus.CONFLICT,
        body: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'Dữ liệu đã tồn tại.',
          details: exception.meta,
        },
      },
      P2003: {
        status: HttpStatus.CONFLICT,
        body: {
          code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
          message: 'Dữ liệu đang được tham chiếu và không thể thay đổi.',
          details: exception.meta,
        },
      },
      P2025: {
        status: HttpStatus.NOT_FOUND,
        body: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Không tìm thấy dữ liệu yêu cầu.',
        },
      },
    };

    return (
      errors[exception.code] ?? {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          code: 'DATABASE_ERROR',
          message: 'Không thể xử lý yêu cầu dữ liệu.',
        },
      }
    );
  }

  private resolveHttpError(exception: HttpException): ResolvedError {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        status,
        body: {
          code: this.statusCodeToErrorCode(status),
          message: response,
        },
      };
    }

    const payload = response as { message?: string | string[] };
    const message = payload.message;
    const messages = Array.isArray(message) ? message : undefined;

    return {
      status,
      body: {
        code: this.statusCodeToErrorCode(status),
        message: messages ? 'Dữ liệu không hợp lệ.' : String(message ?? exception.message),
        ...(messages ? { details: messages } : {}),
      },
    };
  }

  private statusCodeToErrorCode(status: number): string {
    return HttpStatus[status] ?? 'HTTP_ERROR';
  }
}
