import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  API_PREFIX: z.string().trim().min(1).default('api'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:1420')
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.url()).min(1)),
  SWAGGER_ENABLED: booleanString,
  LOG_LEVEL: z.enum(['log', 'error', 'warn', 'debug', 'verbose', 'fatal']).default('log'),
  DATABASE_URL: z
    .url()
    .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
      message: 'DATABASE_URL phải sử dụng giao thức PostgreSQL.',
    }),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET phải có ít nhất 32 ký tự.'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(3600),
  JWT_ISSUER: z.string().trim().min(1).default('pharmacy-records-api'),
  JWT_AUDIENCE: z.string().trim().min(1).default('pharmacy-records-desktop'),
  UPLOAD_DIR: z.string().trim().min(1).default('storage/medical-records'),
  MAX_IMAGE_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1_048_576)
    .max(20_971_520)
    .default(10_485_760),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Cấu hình môi trường không hợp lệ: ${details}`);
  }

  return result.data;
}
