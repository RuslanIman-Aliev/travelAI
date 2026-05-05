type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitState>();

/**
 * Evaluates whether a particular key has exceeded its allowed rate limit within the specified time window.
 *
 * @param {string} key - A unique identifier for the entity being rate-limited (e.g., user ID or IP address).
 * @param {RateLimitOptions} options - The limits for the rate check containing `limit` (max allowed actions) and `windowMs` (time window size).
 * @returns {{allowed: boolean, retryAfterMs: number}} An object indicating if the action is allowed and the required waiting time in milliseconds if blocked.
 */
export const checkRateLimit = (key: string, options: RateLimitOptions) => {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return { allowed: true, retryAfterMs: 0 };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      retryAfterMs: current.resetAt - now,
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);

  return { allowed: true, retryAfterMs: 0 };
};

/**
 * Determines whether a given request originates from the same domain by comparing the 'origin' header with the request URL's origin.
 *
 * @param {Request} request - The incoming HTTP request to check.
 * @returns {boolean} True if the origins match or there's no origin header provided, false otherwise.
 */
export const isSameOriginRequest = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  return origin === new URL(request.url).origin;
};
