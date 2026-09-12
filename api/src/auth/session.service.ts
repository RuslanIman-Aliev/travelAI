import { Injectable } from '@nestjs/common';
import type { SessionUser } from './session-user.type';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 30_000;

const CACHE_SWEEP_THRESHOLD = 1_000;

type CacheEntry = {
  user: SessionUser;
  freshUntil: number;
};

@Injectable()
export class SessionService {
  private readonly cache = new Map<string, CacheEntry>();
  constructor(private readonly prisma: PrismaService) {}
  findUserBySessionToken = async (
    sessionToken: string,
  ): Promise<SessionUser | null> => {
    // Implementation for finding a user by their session token
    if (!sessionToken || sessionToken.trim() === '') {
      return null;
    }

    const cached = this.readFromCache(sessionToken);
    if (cached) {
      return cached;
    }
    const session = await this.prisma.session.findUnique({
      where: { sessionToken },
      select: {
        user: { select: { id: true, email: true, name: true } },
        expires: true,
      },
    });
    if (!session) {
      return null;
    }
    if (session.expires.getTime() < Date.now()) {
      return null;
    }
    this.writeToCache(sessionToken, session.user);
    return session.user;
  };

  private readFromCache(sessionToken: string): SessionUser | null {
    const entry = this.cache.get(sessionToken);
    if (!entry) return null;

    if (entry.freshUntil <= Date.now()) {
      this.cache.delete(sessionToken);
      return null;
    }

    return entry.user;
  }
  private writeToCache(sessionToken: string, user: SessionUser): void {
    const now = Date.now();

    if (this.cache.size > CACHE_SWEEP_THRESHOLD) {
      this.evictExpired(now);
    }

    this.cache.set(sessionToken, { user, freshUntil: now + CACHE_TTL_MS });
  }

  private evictExpired(now: number): void {
    for (const [token, entry] of this.cache) {
      if (entry.freshUntil <= now) this.cache.delete(token);
    }
  }
}
