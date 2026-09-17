import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Prisma CLI commands (migrations, introspection and Studio) need a
    // session-capable connection. The NestJS runtime continues to use the
    // pooled DATABASE_URL through PrismaService.
    url: env('DIRECT_URL'),
  },
});
