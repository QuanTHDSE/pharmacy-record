import type { AuthenticatedUser } from './authenticated-user.js';
import type { RequestWithId } from './request-with-id.js';

export interface RequestWithUser extends RequestWithId {
  user: AuthenticatedUser;
}
