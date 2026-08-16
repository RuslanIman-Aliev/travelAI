# Travel AI

Travel AI is a Next.js app that helps users plan trips with AI and build live routes on a map.

## Features

- Google OAuth authentication with NextAuth and Prisma adapter
- Create a new trip by destination, country, date range, interests, and budget
- Background itinerary generation with Gemini + Inngest
- Day-by-day trip page with activities and Google Maps markers
- Live Guide mode for nearby places and a generated Google Maps route
- Dashboard with user trip statistics

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4 and Radix UI
- Prisma ORM with PostgreSQL
- NextAuth v5
- Inngest for background workflows
- Google Maps and Places APIs
- Gemini API (`@google/generative-ai`)
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

2. In a second terminal, start the Inngest dev server:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

3. Open `http://localhost:3000`

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

| Method | Route                        | Purpose                                              |
| ------ | ---------------------------- | ---------------------------------------------------- |
| `POST` | `/api/trips/{id}/generation` | Claim the trip and enqueue itinerary generation      |
| `GET`  | `/api/trips/{id}/generation` | Read generation status, used for client-side polling |
| `*`    | `/api/inngest`               | Inngest function endpoint                            |
| `*`    | `/api/auth/[...nextauth]`    | NextAuth handlers                                    |

Everything else runs through Server Actions in `lib/actions/`. Those are public
endpoints too, so each one authenticates, rate limits and validates its own input
rather than trusting the form that called it.

## Testing

```bash
npm run test
```

Jest runs in the `node` environment by default, because most of the suite exercises
server code. Component tests opt into jsdom with a `@jest-environment jsdom` docblock.

Current automated tests cover:

- Cost parsing/formatting and itinerary sorting (`lib/cost.test.ts`, `lib/itinerary.test.ts`)
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
lib/
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
3. The trip page sees an ungenerated trip and `POST`s to
   `/api/trips/[id]/generation`, which claims the trip with a conditional
   `updateMany` and sends a deduplicated `trip.generate` event.
4. The Inngest function calls Gemini, validates the response with Zod, and writes the
   days, activities and the `generated` status in one transaction.
5. The client polls `GET /api/trips/[id]/generation` and refreshes once the job
   reaches a terminal state.

## Known Limitations

- Rate limiting is an in-memory fixed-window counter (`lib/security.ts`). On a
  serverless host each instance keeps its own map, so the effective limit scales with
  the number of instances. It stops accidental double-submits, not determined abuse;
  the production shape is a shared store such as `@upstash/ratelimit` on Redis.
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
