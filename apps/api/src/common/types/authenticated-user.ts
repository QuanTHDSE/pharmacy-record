import type { UserRole } from '../../generated/prisma/enums.js';

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}
