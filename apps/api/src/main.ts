import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType, type LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { notFoundHandler } from './common/middleware/not-found.middleware.js';
import type { Environment } from './config/environment.js';
import { setupSwagger } from './config/swagger.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);
  const host = config.get('HOST', { infer: true });
  const port = config.get('PORT', { infer: true });
  const apiPrefix = config.get('API_PREFIX', { infer: true });
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  const configuredLogLevel = config.get('LOG_LEVEL', { infer: true });

  app.useLogger(resolveLogLevels(configuredLogLevel));

  app.use(helmet());
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    setupSwagger(app);
  }

  await app.init();
  app.use(notFoundHandler);
  await app.listen(port, host);

  Logger.log(`API đang chạy tại ${await app.getUrl()}/${apiPrefix}/v1`, 'Bootstrap');
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    Logger.log(`Swagger UI: ${await app.getUrl()}/${apiPrefix}/docs`, 'Bootstrap');
  }
}

function resolveLogLevels(configuredLevel: LogLevel): LogLevel[] {
  const levels: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];
  return levels.slice(0, levels.indexOf(configuredLevel) + 1);
}

void bootstrap();
