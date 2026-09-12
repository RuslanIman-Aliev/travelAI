import type { Request } from 'express';
import type { SessionUser } from './session-user.type';

/**
 * The express request as this module sees it.
 *
 * `user` is optional because it is absent until the guard puts it there - the
 * guard writes this field, `@CurrentUser()` reads it, and both import this type
 * so the two cannot drift apart.
 */
export type RequestWithUser = Request & {
  user?: SessionUser;
};
