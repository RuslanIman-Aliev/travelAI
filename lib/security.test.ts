import {
  checkRateLimit,
  isSameOriginRequest,
  resetRateLimits,
} from "@/lib/security";

describe("checkRateLimit", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetRateLimits();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const options = { limit: 3, windowMs: 60_000 };

  it("allows requests up to the limit", () => {
    for (let i = 0; i < options.limit; i += 1) {
      expect(checkRateLimit("user_1", options).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    for (let i = 0; i < options.limit; i += 1)
      checkRateLimit("user_1", options);

    const blocked = checkRateLimit("user_1", options);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(options.windowMs);
  });

  it("keys limits per caller", () => {
    for (let i = 0; i < options.limit; i += 1)
      checkRateLimit("user_1", options);

    expect(checkRateLimit("user_1", options).allowed).toBe(false);
    expect(checkRateLimit("user_2", options).allowed).toBe(true);
  });

  it("resets once the window has elapsed", () => {
    for (let i = 0; i < options.limit; i += 1)
      checkRateLimit("user_1", options);
    expect(checkRateLimit("user_1", options).allowed).toBe(false);

    jest.advanceTimersByTime(options.windowMs + 1);

    expect(checkRateLimit("user_1", options).allowed).toBe(true);
  });

  it("does not extend the window while a caller keeps retrying", () => {
    for (let i = 0; i < options.limit; i += 1)
      checkRateLimit("user_1", options);

    jest.advanceTimersByTime(options.windowMs - 1_000);
    const stillBlocked = checkRateLimit("user_1", options);
    expect(stillBlocked.allowed).toBe(false);
    expect(stillBlocked.retryAfterMs).toBeLessThanOrEqual(1_000);

    jest.advanceTimersByTime(1_001);
    expect(checkRateLimit("user_1", options).allowed).toBe(true);
  });
});

describe("isSameOriginRequest", () => {
  const request = (origin?: string) =>
    new Request("https://travel.example.com/api/trips/abc/generation", {
      headers: origin ? { origin } : undefined,
    });

  it("accepts a matching origin", () => {
    expect(isSameOriginRequest(request("https://travel.example.com"))).toBe(
      true,
    );
  });

  it("rejects a different origin", () => {
    expect(isSameOriginRequest(request("https://evil.example.com"))).toBe(
      false,
    );
  });

  it("accepts a request with no origin header", () => {
    expect(isSameOriginRequest(request())).toBe(true);
  });
});
