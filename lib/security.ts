type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

/**
 * KNOWN LIMITATION - this is a single-process, in-memory fixed-window limiter.
 *
 * On a serverless host (Vercel) every cold start gets a fresh Map and concurrent
 * instances do not share state, so the effective limit is `limit x instances`.
 * It exists to stop accidental double-submits and trivial local abuse, not as a
 * real abuse control. The production shape is a shared store keyed the same way
 * - `@upstash/ratelimit` on Redis is the drop-in for this stack, and
 * `checkRateLimit` is deliberately the only call site so swapping it is local.
 */
const rateLimitStore = new Map<string, RateLimitState>();

/** Sweep expired keys once the map grows past this, so it cannot leak. */
const SWEEP_THRESHOLD = 1_000;

/**
 * Drops every expired entry. Without this the map only ever grows, since an
 * entry is otherwise rewritten only when its own key is seen again.
 *
 * @param {number} now - Current epoch milliseconds.
 * @returns {void}
 */
const evictExpired = (now: number) => {
  for (const [key, state] of rateLimitStore) {
    if (state.resetAt <= now) rateLimitStore.delete(key);
  }
};

/**
 * Evaluates whether a particular key has exceeded its allowed rate limit within the specified time window.
 *
 * @param {string} key - A unique identifier for the entity being rate-limited (e.g., user ID or IP address).
 * @param {RateLimitOptions} options - The limits for the rate check containing `limit` (max allowed actions) and `windowMs` (time window size).
 * @returns {RateLimitResult} An object indicating if the action is allowed and the required waiting time in milliseconds if blocked.
 */
export const checkRateLimit = (
  key: string,
  options: RateLimitOptions,
): RateLimitResult => {
  const now = Date.now();

  if (rateLimitStore.size > SWEEP_THRESHOLD) {
    evictExpired(now);
  }

  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (current.count >= options.limit) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  return { allowed: true, retryAfterMs: 0 };
};

/** Test seam: drops all rate-limit state. */
export const resetRateLimits = () => {
  rateLimitStore.clear();
};

/**
 * Rejects cross-origin requests. Next.js already applies an origin check to
 * Server Actions; this covers the hand-written route handlers.
 *
 * A missing `Origin` header is allowed because browsers always send one on the
 * cross-origin POSTs this is meant to block, while same-origin navigations and
 * server-to-server callers may omit it.
 *
 * @param {Request} request - The incoming HTTP request to check.
 * @returns {boolean} True if the origins match or there's no origin header provided, false otherwise.
 */
export const isSameOriginRequest = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  return origin === new URL(request.url).origin;
};
