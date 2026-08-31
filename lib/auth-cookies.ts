/**
 * Cookie names, kept in a leaf module on purpose.
 *
 * `middleware.ts` runs on the Edge runtime, where Prisma cannot be bundled, so
 * it must not import `auth.ts`. This file has no dependencies and can be read
 * from both sides.
 */

/** Set by the Playwright sign-in shortcut. Never present in production. */
export const E2E_COOKIE_NAME = "e2e-auth";

/**
 * Auth.js v5 session cookie. The `__Secure-` prefix is added automatically when
 * the site is served over HTTPS, so both spellings have to be recognised.
 */
export const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

/**
 * Whether a request carries something that looks like a session.
 *
 * Presence, not validity: verifying a database session means querying Postgres,
 * which the Edge runtime cannot do. This is the cheap redirect check - every
 * page and every action still calls `auth()` or `requireUserId()`, and those are
 * what actually authorise anything.
 *
 * @param {{ has: (name: string) => boolean }} cookies - The request's cookie jar.
 * @returns {boolean} True when a session cookie is present.
 */
export const hasSessionCookie = (cookies: {
  has: (name: string) => boolean;
}): boolean =>
  cookies.has(E2E_COOKIE_NAME) ||
  SESSION_COOKIE_NAMES.some((name) => cookies.has(name));
