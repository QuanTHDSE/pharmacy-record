import { randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import type { RequestHandler } from 'express';
import type { ApiErrorResponse } from '../interfaces/api-response.js';
import type { RequestWithId } from '../types/request-with-id.js';

export const notFoundHandler: RequestHandler = (request, response) => {
  const typedRequest = request as RequestWithId;
  const requestId = typedRequest.requestId || randomUUID();
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Không tìm thấy tài nguyên yêu cầu.',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      path: request.originalUrl,
    },
  };

  response.setHeader('x-request-id', requestId);
  response.status(HttpStatus.NOT_FOUND).json(body);
};
