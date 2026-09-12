# Travel AI API

NestJS backend for the Travel AI web app. Serves trips and the status of
AI-generated itineraries to the Next.js front end in the parent directory.

Full endpoint reference: [`docs/api.md`](../docs/api.md). Machine-readable
schema: [`openapi.json`](./openapi.json).

## What lives here, and what does not

The split is deliberate and worth knowing before reading the code.

| Here | Still in Next |
|---|---|
| Reading, renaming and deleting trips | Creating, retrying and reordering trips |
| Itinerary generation **status** | **Starting** a generation, and the Inngest job that runs it |
| Session **validation** | Session **issuance** — sign-in, sign-out, Auth.js |
| — | Live Guide routes, geocoding, place search |

Two consequences of that:

- **This service issues nothing.** Auth.js writes a row to the `Session` table
  when a user signs in; every request here is authorised by looking that row up
  by its cookie. There is no shared secret and no JWT to verify, because the
  token is opaque.
- **The database schema is owned by the parent project.** `prisma/schema.prisma`
  lives at the repository root; this app generates a client from it and never
  migrates it.

## Running it

Install from the **repository root** — this is an npm workspace, and installing
inside `api/` breaks hoisting.

```bash
npm install                  # from the repository root
npm run start:dev -w api     # watch mode on :3001
```

The front end is a separate process:

```bash
npm run dev                  # Next on :3000
```

| | |
|---|---|
| Swagger UI | http://localhost:3001/docs |
| OpenAPI JSON | http://localhost:3001/docs-json |
| Health | http://localhost:3001/api/v1/health |

Requests from the browser do **not** go to `:3001` directly. `next.config.ts`
rewrites `/backend/*` to this service, so every call is same-origin and the
session cookie travels with it — see [Why the proxy](#why-the-proxy).

## Environment

Read from the **root** `.env`, not from a file in this directory:
`ConfigModule` is pointed at `../.env` so both apps share one source of truth.
Validated by a Zod schema on startup, so a missing variable fails the boot
rather than the first request.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | The same Postgres the Next app uses. Append `&pgbouncer=true` when the host is a PgBouncer endpoint — a long-lived process breaks prepared statements through one otherwise |
| `WEB_ORIGIN` | no | `http://localhost:3000` | Allowed CORS origin, with credentials |
| `API_PORT` | no | `3001` | |
| `NODE_ENV` | no | `development` | |

Nothing else. No AI keys, no Google keys, no `NEXTAUTH_SECRET` — that logic and
those secrets stay in the Next app.

## Scripts

| | |
|---|---|
| `npm run start:dev -w api` | Watch mode |
| `npm run build -w api` | Compile to `dist/` |
| `npm run start:prod -w api` | Run the compiled output |
| `npm run lint -w api` | ESLint with `--fix` |
| `npm run format -w api` | Prettier. Run it after every `nest g` — the generator writes CRLF on Windows |
| `npm run docs:openapi -w api` | Regenerate `openapi.json` |
| `npm run prisma:generate -w api` | Regenerate the Prisma client from the root schema |

Root-level `tsc`, `prettier` and `eslint` deliberately ignore this directory —
it has its own configs and its own scripts.

## How a request is handled

```
cookie-parser  →  SessionGuard  →  RateLimitGuard  →  ZodValidationPipe  →  handler
                                                                              ↓
                                              AllExceptionsFilter  ←  anything thrown
```

**`SessionGuard`** ([`src/auth/session.guard.ts`](./src/auth/session.guard.ts))
is global, registered under `APP_GUARD`, so every route is closed unless it
carries `@Public()`. Exactly one does: `GET /health`. It reads the session cookie
(both spellings — the `__Secure-` prefix appears over HTTPS), falls back to a
bearer header for clients that cannot send cookies, and resolves the row through
`SessionService`. Resolved sessions are cached in memory for 30 seconds, so a
sign-out is honoured up to that long after it happens.

**`RateLimitGuard`** ([`src/common/rate-limit/`](./src/common/rate-limit)) counts
requests per user per route, but only where `@RateLimit()` asks for it — the
write endpoints, at 20 a minute each, matching the limits the Next actions
already enforced. It runs after the session guard so it can key on the user, and
falls back to the caller's address if it ever runs earlier.

**`ZodValidationPipe`** ([`src/common/pipes/`](./src/common/pipes)) is
constructed with a schema at the parameter it guards. Validation is Zod, not
`class-validator`: the schemas are shared with the parent project's conventions,
and the AI response schema doubles as the JSON Schema for constrained decoding
on the Next side. One consequence: Swagger cannot read a Zod schema, so request
parameters and bodies are described with explicit `@ApiQuery` / `@ApiBody`
decorators. Those and the schema are the one pair in this codebase that can
drift silently.

**`AllExceptionsFilter`**
([`src/common/filters/`](./src/common/filters)) catches everything and gives
every failure one shape. Prisma error codes map to statuses; anything
unrecognised is logged in full and answered with a generic message, because
Prisma errors carry table names, column names and connection details.

## Why the proxy

The session cookie is `SameSite=Lax`, so a browser will not send it to a
different site — and every `*.vercel.app` deployment is its own site, because
`vercel.app` is a public suffix. Calling this API directly from the browser would
arrive unauthenticated no matter how CORS were configured, and the bearer
fallback does not help because the cookie is `HttpOnly` and unreadable from
JavaScript.

So the front end calls `/backend/*` on its own origin and `next.config.ts`
rewrites that to this service. Same-origin request, cookie attached
automatically, no preflight, and this service's host stays private. The cost is
one extra hop per call.

## One thing the move actually fixed

The rate limiter is a fixed-window counter in a `Map`. On the Next side the same
code carried a standing caveat, written into
[`lib/security.ts`](../lib/security.ts) and the root README: on a serverless host
every instance keeps its own map, so the effective limit was `limit × instances`
and it only ever stopped accidental double-submits.

Here there is one long-lived process, so the count is the count. The same
function finally does what it always claimed to — which is also why the session
cache above is worth having at all.

The honest limit: run more than one instance and it is approximate again. The
production shape is a shared counter in Redis, and `check` is deliberately the
only entry point so that swap stays local.
