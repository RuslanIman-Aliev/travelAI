# Travel AI

Travel AI is a Next.js app that helps users plan trips with AI and build live routes on a map.

The backend is being moved out of Next into a separate NestJS service in
[`api/`](./api). Reading, renaming and deleting trips and the generation status
are served from there; creating trips, the Inngest job, Live Guide, geocoding and
place search are still Next server actions. See [`api/README.md`](./api/README.md)
for the split and [`docs/api.md`](./docs/api.md) for the endpoint reference.

## Features

- Google OAuth authentication with NextAuth and Prisma adapter
- Create a new trip by destination, country, date range, interests, and budget
- Background itinerary generation with Gemini + Inngest
- Day-by-day trip page with activities and Google Maps markers
- Live Guide mode for nearby places and a generated Google Maps route
- Dashboard with user trip statistics

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- NestJS 11 for the extracted HTTP API (`api/`)
- Tailwind CSS v4 and Radix UI
- Prisma ORM with PostgreSQL
- NextAuth v5
- Inngest for background workflows
- Google Maps and Places APIs
- Gemini API (`@google/genai`)
- Pexels API for destination images

## Prerequisites

- Node.js 20+
- npm 10+ (or another package manager)
- PostgreSQL database (local or cloud, for example Neon)

## Environment Variables

Copy `.env.example` to `.env` and fill it in. Two notes worth calling out:

- **Two Google Maps keys, not one.**
  `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` ships inside the client bundle and must be
  restricted by HTTP referrer, limited to the Maps JavaScript API.
  `GOOGLE_PLACES_API_KEY` is used only from server code, must not carry the
  `NEXT_PUBLIC_` prefix, and should be IP-restricted. Using one public key for both
  lets anyone lift it from the bundle and bill your account.
- **`GEMINI_THINKING_LEVEL` is the main latency knob.** Gemini 3 models reason
  before answering, and that reasoning is usually the largest part of the wait.
  The default is `LOW`; `MINIMAL` is faster but tends to cost coordinate accuracy
  and budget adherence. Every generation logs `[gemini] itinerary generated` with
  the duration and the split between `thoughtsTokens` and `outputTokens`, so the
  trade can be measured rather than guessed.
- **`ENABLE_TEST_AUTH` is development-only.** It enables a cookie-based sign-in
  shortcut for Playwright. `isTestAuthEnabled` in [`auth.ts`](auth.ts) additionally
  requires `NODE_ENV !== "production"`, so setting the variable in a production
  environment does nothing.

Generate a `NEXTAUTH_SECRET` value with either:

```bash
openssl rand -base64 32
```

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Installation

```bash
npm install
```

`prisma generate` runs automatically after install via `postinstall`.

## Database Setup

The schema is managed with migrations (`prisma/migrations`), not `db push`.

```bash
npx prisma migrate dev
```

If you are pointing at a pre-existing database that already matches the schema,
baseline it instead of re-running the initial migration:

```bash
npx prisma migrate resolve --applied 20260816000000_init
```

Optional database UI:

```bash
npx prisma studio
```

### Schema notes

- Money is stored in integer minor units (`Activity.estimatedCostCents`) with a
  separate currency column, and budgets as `budgetMin` / `budgetMax` / `budgetCurrency`.
  The model returns free text like `"20 EUR"`; that string is parsed exactly once,
  on the ingestion path, rather than with a regex on every render.
- `Trip.status` is a `TripStatus` enum (`draft`, `generating`, `generated`, `failed`).
  `generating` is claimed atomically before the background job is enqueued.
- `Day` has a unique constraint on `(tripId, dayNumber)` so a retried generation job
  cannot insert a duplicate copy of the itinerary.

## Run Locally

1. Start the Next.js app:

```bash
npm run dev
```

2. In a second terminal, start the API:

```bash
npm run start:dev -w api
```

3. In a third terminal, start the Inngest dev server:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

4. Open `http://localhost:3000`

The browser never calls the API directly: `next.config.ts` rewrites `/backend/*`
to it, so requests stay same-origin and the session cookie travels with them.
Without the API running, reading the trip list still works — those pages have not
moved yet — but renaming, deleting and the generation poll do not.

Note: if the Inngest dev server is not running, trip generation jobs will not execute.

## Available Scripts

- `npm run dev` - Start local development server
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run `tsc --noEmit`
- `npm run format` / `npm run format:check` - Prettier
- `npm run test` - Run Jest test suite once
- `npm run test:watch` - Run Jest in watch mode
- `npm run test:coverage` - Run Jest with coverage report
- `npm run test:e2e` - Run Playwright e2e tests
- `npm run test:e2e:headed` - Run Playwright tests in headed mode

## API

Served by the NestJS app in [`api/`](./api), reached through the `/backend`
rewrite. Full reference with examples: [`docs/api.md`](./docs/api.md). Swagger UI
at `http://localhost:3001/docs`, schema in [`api/openapi.json`](./api/openapi.json).

| Method   | Route                           | Purpose                                    |
| -------- | ------------------------------- | ------------------------------------------ |
| `GET`    | `/api/v1/health`                | Liveness probe. No session needed          |
| `GET`    | `/api/v1/me`                    | The signed-in user                         |
| `GET`    | `/api/v1/trips`                 | List trips, paginated and filterable       |
| `GET`    | `/api/v1/trips/{id}`            | One trip with days and activities          |
| `PATCH`  | `/api/v1/trips/{id}`            | Rename                                     |
| `DELETE` | `/api/v1/trips/{id}`            | Delete                                     |
| `GET`    | `/api/v1/trips/{id}/generation` | Generation status, polled by the trip page |

Still served by Next:

| Method | Route                        | Purpose                                                                                           |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `POST` | `/api/trips/{id}/generation` | Claim the trip and enqueue generation. Currently unused — generation is started from `insertTrip` |
| `*`    | `/api/inngest`               | Inngest function endpoint                                                                         |
| `*`    | `/api/auth/[...nextauth]`    | NextAuth handlers                                                                                 |

Everything not yet moved runs through Server Actions in `lib/actions/`. Those are
public endpoints too, so each one authenticates, rate limits and validates its own
input rather than trusting the form that called it.

## Testing

```bash
npm run test
```

Jest runs in the `node` environment by default, because most of the suite exercises
server code. Component tests opt into jsdom with a `@jest-environment jsdom` docblock.

Current automated tests cover:

- Cost parsing/formatting and itinerary sorting (`lib/cost.test.ts`, `lib/itinerary.test.ts`)
- The Gemini JSON Schema conversion (`lib/gemini-schema.test.ts`)
- Zod schema validation (`lib/validators.test.ts`)
- Error formatting and the Pexels client (`lib/utils.test.ts`)
- Rate limiting and same-origin checks (`lib/security.test.ts`)
- The e2e auth gate (`auth.test.ts`)
- Server actions with Prisma/Auth mocks (`lib/actions/*.test.ts`)
- The generation route handler, including the concurrent-claim path
  (`app/api/trips/[id]/generation/route.test.ts`)
- The Inngest generation job (`lib/inngest/functions.test.ts`)
- Sidebar navigation UI (`components/sidebar-menu-main.test.tsx`)

## End-to-End Testing (Playwright)

Install browser binaries once:

```bash
npx playwright install chromium
```

Run e2e tests:

```bash
npm run test:e2e
```

Notes:

- Playwright starts the app automatically using `playwright.config.ts`.
- E2E auth uses a test credentials mode (`ENABLE_TEST_AUTH=true`) so Google OAuth is
  not required. This only works outside production builds.
- A working `DATABASE_URL` is required for trip flow e2e tests.
- The generation endpoint is stubbed, so the flow does not need Inngest or Gemini.
- E2E test data is auto-cleaned before and after each test by deleting the
  `E2E_TEST_EMAIL` user (cascade removes related trip data).

## Project Structure

```text
app/
	(root)/
		live-guide/
		new-trip/
		trip/[id]/
	api/
		auth/[...nextauth]/
		inngest/
		trips/[id]/generation/
components/
api/                    NestJS API - see api/README.md
	src/
		auth/           Session guard, decorators, /me
		common/         Pipe, exception filter, rate limiter, response DTOs
		trips/          Trips and generation endpoints
	openapi.json    Generated schema
docs/
	api.md          Endpoint reference
lib/
	api-client.ts   Typed fetch wrapper for the API
	actions/        Server Actions (auth, trips, live guide, geocoding)
	inngest/        Background job client + functions
	google-maps-api/
	cost.ts         Money parsing (ingestion) and formatting (display)
	itinerary.ts    Activity filtering and sorting
	security.ts     Rate limiting and origin checks
	validators.ts   Zod schemas shared by forms, actions and routes
prisma/
	migrations/
```

## Main Flow

1. User signs in with Google.
2. User creates a trip (`insertTrip` action) and is redirected to `/trip/[id]`.
3. `insertTrip` claims the trip with a conditional `updateMany` and sends a
   deduplicated `trip.generate` event, so a browser that never loads the trip page
   cannot leave a trip with nothing scheduled to pick it up.
4. The Inngest function calls Gemini, validates the response with Zod, and writes the
   days, activities and the `generated` status in one transaction. The request caps
   the thinking budget, and constrains decoding to a JSON Schema derived from
   `aiGenerationResponseSchema` — a union, so the model can still return
   `{ "error": ... }` for an unrecognisable destination. `lib/gemini-schema.ts`
   strips the JSON Schema keywords zod emits that Gemini does not accept
   (`$schema`, `default`, `minLength`).
5. The client polls `GET /backend/trips/[id]/generation`, which the rewrite
   forwards to the NestJS app, and refreshes once the job reaches a terminal state.

## Known Limitations

- Rate limiting is an in-memory fixed-window counter. In the NestJS app it is
  correct, because there is one long-lived process. The copy still guarding the
  Next server actions (`lib/security.ts`) is not: on a serverless host every
  instance keeps its own map, so the effective limit scales with the number of
  instances. The production shape for both is a shared store such as
  `@upstash/ratelimit` on Redis.
- Activity costs come back from the model in the destination's currency while budgets
  are captured in USD, so over-budget warnings are suppressed when the two currencies
  differ rather than being converted.

## Troubleshooting

- Trip is stuck in loading state:
  Ensure the Inngest dev server is running.
- Google map does not load:
  Verify `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` and enable the Maps JavaScript API.
- Place search returns "Place search is not configured":
  Set `GOOGLE_PLACES_API_KEY` and enable the Places API.
- Prisma client errors:
  Run `npm install` and `npx prisma migrate dev`.
- Google sign-in fails:
  Verify OAuth credentials and the redirect URL in Google Cloud Console.
