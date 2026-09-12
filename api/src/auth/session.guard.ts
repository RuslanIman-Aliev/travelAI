import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './auth.constants';
import { SESSION_COOKIE_NAMES } from './cookie-names';
import type { RequestWithUser } from './request-with-user.type';
import { SessionService } from './session.service';

const BEARER_PREFIX = 'bearer ';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = this.getRequest(context);
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No session token found in request');
    }
    const user = await this.sessionService.findUserBySessionToken(token);

    if (!user) {
      throw new UnauthorizedException('Invalid session token');
    }
    request.user = user;

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private getRequest(context: ExecutionContext): RequestWithUser {
    return context.switchToHttp().getRequest<RequestWithUser>();
  }

  private extractToken(request: RequestWithUser): string | null {
    const cookies: unknown = request.cookies;

    if (cookies !== null && typeof cookies === 'object') {
      const jar = cookies as Record<string, unknown>;

      for (const name of SESSION_COOKIE_NAMES) {
        const value = jar[name];
        if (typeof value === 'string' && value.length > 0) {
          return value;
        }
      }
    }

    const authorization = request.headers.authorization;

    if (
      typeof authorization === 'string' &&
      authorization.slice(0, BEARER_PREFIX.length).toLowerCase() ===
        BEARER_PREFIX
    ) {
      const token = authorization.slice(BEARER_PREFIX.length).trim();
      if (token.length > 0) {
        return token;
      }
    }

    return null;
  }
}
