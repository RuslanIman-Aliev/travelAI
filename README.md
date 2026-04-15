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

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="replace_with_long_random_secret"

GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

GEMINI_API_KEY="..."
NEXT_PUBLIC_GOOGLE_MAP_API="..."
PEXELS_API_KEY="..."
```

Generate a `NEXTAUTH_SECRET` value with one of these commands:

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

Push schema to your database:

```bash
npx prisma db push
```

Optional database UI:

```bash
npx prisma studio
```

## Run Locally

1. Start the Next.js app:

```bash
npm run dev
```

2. In a second terminal, start Inngest dev server:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

3. Open `http://localhost:3000`

Note: if Inngest dev server is not running, trip generation jobs will not execute.

## Available Scripts

- `npm run dev` - Start local development server
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Jest test suite once
- `npm run test:watch` - Run Jest in watch mode
- `npm run test:coverage` - Run Jest with coverage report
- `npm run test:e2e` - Run Playwright e2e tests
- `npm run test:e2e:headed` - Run Playwright tests in headed mode

## Testing

Run all tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

Current automated tests include:

- Utility and error handling tests in `lib/utils.test.ts`
- Zod schema validation tests in `lib/validators.test.ts`
- UI behavior tests for sidebar navigation in `components/sidebar-menu-main.test.tsx`
- Server actions tests with Prisma/Auth mocks in `lib/actions/*.test.ts`

## End-to-End Testing (Playwright)

Install browser binaries once:

```bash
npx playwright install chromium
```

Run e2e tests:

```bash
npm run test:e2e
```

Run e2e in headed mode:

```bash
npm run test:e2e:headed
```

Notes:

- Playwright starts the app automatically using `playwright.config.ts`.
- E2E auth uses a test credentials mode (`ENABLE_TEST_AUTH=true`) so Google OAuth is not required in e2e.
- A working `DATABASE_URL` is required for trip flow e2e tests.
- E2E test data is auto-cleaned before and after each test by deleting the `E2E_TEST_EMAIL` user (cascade removes related trip data).

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
		start-trip/
components/
lib/
	actions/
	inggest/
prisma/
```

## Main Flow

1. User signs in with Google.
2. User creates a trip.
3. App sends `trip.generate` event through `/api/start-trip`.
4. Inngest function generates itinerary with Gemini and saves it to PostgreSQL via Prisma.
5. User opens `/trip/[id]` and sees the itinerary and map.

## Troubleshooting

- Trip is stuck in loading state:
  Ensure Inngest dev server is running.
- Google map does not load:
  Verify `NEXT_PUBLIC_GOOGLE_MAP_API` and enable Maps JavaScript API + Places API.
- Prisma client errors:
  Run `npm install` and `npx prisma db push`.
- Google sign-in fails:
  Verify OAuth credentials and redirect URL in Google Cloud Console.
