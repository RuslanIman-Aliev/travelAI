import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { RequestWithUser } from '../../auth/request-with-user.type';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';
import { RateLimitService, type RateLimitOptions } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const result = this.rateLimit.check(this.keyFor(context, request), options);

    if (!result.allowed) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader(
          'Retry-After',
          String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))),
        );

      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private keyFor(context: ExecutionContext, request: RequestWithUser): string {
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const identity = request.user?.id ?? request.ip ?? 'anonymous';

    return `${route}:${identity}`;
  }
}
