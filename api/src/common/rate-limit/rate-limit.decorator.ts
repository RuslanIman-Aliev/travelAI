import { SetMetadata } from '@nestjs/common';
import type { RateLimitOptions } from './rate-limit.service';

export const RATE_LIMIT_KEY = 'rateLimit';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
