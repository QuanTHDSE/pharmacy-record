import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/common/security/password.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { UserRole } from '../src/generated/prisma/enums.js';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
}

async function seed(): Promise<void> {
  const connectionString = requiredEnvironment('DATABASE_URL');
  const email = requiredEnvironment('ADMIN_EMAIL').toLowerCase();
  const fullName = requiredEnvironment('ADMIN_FULL_NAME');
  const password = requiredEnvironment('ADMIN_PASSWORD');

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD phải có ít nhất 12 ký tự.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { fullName, role: UserRole.ADMIN, isActive: true },
      });
      console.log(`Đã cập nhật tài khoản ADMIN hiện có: ${email}`);
      return;
    }

    await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash: await hashPassword(password),
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    console.log(`Đã tạo tài khoản ADMIN: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

void seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
