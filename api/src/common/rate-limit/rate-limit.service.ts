import { Injectable } from '@nestjs/common';

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const SWEEP_THRESHOLD = 1_000;

@Injectable()
export class RateLimitService {
  private readonly store = new Map<string, RateLimitState>();

  check(key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult {
    const now = Date.now();

    if (this.store.size > SWEEP_THRESHOLD) {
      this.evictExpired(now);
    }

    const current = this.store.get(key);

    if (!current || current.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (current.count >= limit) {
      return { allowed: false, retryAfterMs: current.resetAt - now };
    }

    current.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  private evictExpired(now: number): void {
    for (const [key, state] of this.store) {
      if (state.resetAt <= now) this.store.delete(key);
    }
  }
}
