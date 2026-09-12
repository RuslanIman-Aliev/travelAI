import { z } from 'zod';
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});
export const E2E_COOKIE_NAME = 'e2e-auth';

/**
 * Auth.js v5 session cookie. The `__Secure-` prefix is added automatically when
 * the site is served over HTTPS, so both spellings have to be recognised.
 */
export const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
] as const;

export const validate = (config: Record<string, unknown>) =>
  envSchema.parse(config);
