/**
 * Auth.js v5 session cookie. The `__Secure-` prefix is added automatically when
 * the site is served over HTTPS, so both spellings have to be recognised - and
 * on `http://localhost` only the bare one ever appears.
 *
 * Duplicated from `lib/auth-cookies.ts` on the Next side rather than imported:
 * the two apps have to agree on these names, but the API cannot reach into the
 * web app's source. If one side changes them, change both.
 */
export const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
] as const;
