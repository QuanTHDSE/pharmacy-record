import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { RequestWithId } from '../types/request-with-id.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const message = `${request.method} ${request.originalUrl}`;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${message} ${response.statusCode} ${Date.now() - startedAt}ms requestId=${request.requestId}`,
          );
        },
        error: (error: unknown) => {
          const status = error instanceof HttpException ? error.getStatus() : 500;
          this.logger.error(
            `${message} ${status} ${Date.now() - startedAt}ms requestId=${request.requestId}`,
          );
        },
      }),
    );
  }
}
