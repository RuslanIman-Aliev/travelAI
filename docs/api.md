# Travel AI API

HTTP API behind the Travel AI web app. Trips and the status of AI-generated
itineraries. Sessions are issued elsewhere — see [Authentication](#authentication).

|                     |                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Base URL (local)    | `http://localhost:3001/api/v1`                                                                 |
| Interactive docs    | `http://localhost:3001/docs`                                                                   |
| OpenAPI document    | `http://localhost:3001/docs-json`, or the checked-in [`api/openapi.json`](../api/openapi.json) |
| Regenerate the file | `npm run docs:openapi -w api`                                                                  |

Versioning is part of the path (`/api/v1`), set once as a global prefix in
[`api/src/main.ts`](../api/src/main.ts). There is no header- or
media-type-based versioning.

Requests and responses are `application/json`, UTF-8. Two endpoints answer
`204 No Content` and send no body at all. No endpoint accepts or returns
anything else — there are no file uploads and no streaming responses.

## Authentication

The API **does not issue sessions**. The Next.js front end signs the user in
through Auth.js, which writes a row to the `Session` table in Postgres. Every
request here is authorised by looking that row up.

|                            |                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Scheme                     | Session cookie, `authjs.session-token` (`__Secure-authjs.session-token` over HTTPS)                |
| Alternative                | `Authorization: Bearer <SESSION_TOKEN>`, carrying the same token                                   |
| Where the token comes from | Sign in at the web app; the cookie is set by Auth.js                                               |
| Lifetime                   | Decided by Auth.js and stored in `Session.expires`; this API only reads it                         |
| Refresh                    | None here. Renewal is Auth.js's job on the Next side                                               |
| Roles / scopes             | None. Every authenticated user has the same rights, and every query is scoped to the rows they own |

Source: [`api/src/auth/session.guard.ts`](../api/src/auth/session.guard.ts),
[`api/src/auth/session.service.ts`](../api/src/auth/session.service.ts).

The guard is global — registered under `APP_GUARD` — so every route is closed
unless it carries `@Public()`. Exactly one route does: `GET /health`.

Two notes that matter in practice:

- The resolved session is cached in memory for 30 seconds. A sign-out is
  therefore honoured by this API up to that long after it happens.
- Cookies are only sent cross-origin when the caller asks for them. From a
  browser, `fetch` needs `credentials: 'include'`; the API answers with
  `Access-Control-Allow-Credentials` for the origin in `WEB_ORIGIN`.

## Conventions

### Errors

Every failure — validation, authorisation, a missing row, an unhandled
exception — leaves through one filter
([`api/src/common/filters/all-exceptions.filter.ts`](../api/src/common/filters/all-exceptions.filter.ts))
and has the same shape:

```json
{
  "statusCode": 404,
  "message": "No trip found for this user",
  "timestamp": "2026-09-12T11:42:07.331Z",
  "path": "/api/v1/trips/cmf3k9x2b0000v8mc4h7q1abc"
}
```

`message` is a **string, or an array of strings** when several fields failed
validation at once — one entry per field, prefixed with its path.

| Status | When                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------- |
| `200`  | Read succeeded                                                                                      |
| `204`  | Write succeeded, nothing to return                                                                  |
| `400`  | A path parameter, query parameter or body failed its schema                                         |
| `401`  | No session cookie, an unknown token, or an expired one                                              |
| `404`  | The row does not exist, **or belongs to another user** — the two are deliberately indistinguishable |
| `429`  | Rate limit exceeded. `Retry-After` gives the wait in seconds                                        |
| `500`  | Unhandled. The reason is logged server-side and never sent to the client                            |

`409` is reachable in the filter (Prisma `P2002`, a unique-constraint
violation) but no current route can provoke it.

### Pagination

Only `GET /trips` is paginated. Query parameters are optional and coerced from
strings.

| Parameter | Type    | Default | Bounds |
| --------- | ------- | ------- | ------ |
| `page`    | integer | `1`     | ≥ 1    |
| `limit`   | integer | `10`    | 1…50   |

Out-of-range or unparseable values **fall back to the default rather than being
clamped**: `?limit=999` serves 10, not 50. The response echoes the `limit` that
was actually applied, and `totalPages` is computed from it.

An empty page is `200` with `"trips": []`. It is never a `404`.

### Dates

All timestamps are ISO 8601 strings. `startDate` and `endDate` are **calendar
days**, stored as UTC midnight — only the date part carries meaning, and they
must not be re-interpreted in a local timezone.

### Rate limits

| Route               | Limit       |
| ------------------- | ----------- |
| `PATCH /trips/:id`  | 20 / minute |
| `DELETE /trips/:id` | 20 / minute |

Counted per user per route in a fixed window, in the API process's memory
([`api/src/common/rate-limit/rate-limit.service.ts`](../api/src/common/rate-limit/rate-limit.service.ts)).
Reads are not limited. Run more than one instance and the effective limit
multiplies by the instance count.

---

## health

### `GET /api/v1/health`

Liveness probe. Counts trips, so the check fails when the database is
unreachable rather than only when the process is down.

Source: [`api/src/app.controller.ts:15`](../api/src/app.controller.ts#L15)

|            |                                               |
| ---------- | --------------------------------------------- |
| Auth       | **None.** The only route carrying `@Public()` |
| Parameters | None                                          |
| Body       | None                                          |

**`200`**

```json
{ "trips": 35 }
```

```bash
curl -i http://localhost:3001/api/v1/health
```

| Error | When                              | Body                                                         |
| ----- | --------------------------------- | ------------------------------------------------------------ |
| `500` | The database could not be reached | Standard error shape, message `An unexpected error occurred` |

---

## auth

### `GET /api/v1/me`

The signed-in user. Answers from the session the guard already resolved, so it
costs no extra query beyond the one that authorised the request.

Source: [`api/src/auth/me.controller.ts:18`](../api/src/auth/me.controller.ts#L18)

|            |                          |
| ---------- | ------------------------ |
| Auth       | Session cookie or bearer |
| Parameters | None                     |
| Body       | None                     |

**`200`**

```json
{
  "id": "cmf3k9x2b0000v8mc4h7q1abc",
  "email": "traveller@example.com",
  "name": "Alex Traveller"
}
```

`email` and `name` are `null` for an account that never carried them. No other
fields are exposed — the guard loads these three and nothing more.

```bash
curl -i -H "Cookie: authjs.session-token=<SESSION_TOKEN>" \
  http://localhost:3001/api/v1/me
```

| Error | When                                         | Body                                                          |
| ----- | -------------------------------------------- | ------------------------------------------------------------- |
| `401` | No cookie, unknown token, or expired session | `No session token found in request` / `Invalid session token` |

---

## trips

### `GET /api/v1/trips`

List the caller's trips, newest first. Every query is scoped to the session, so
trips belonging to other users are unreachable.

Source: [`api/src/trips/trips.controller.ts:52`](../api/src/trips/trips.controller.ts#L52) ·
service [`trips.service.ts:8`](../api/src/trips/trips.service.ts#L8)

| Query    | Type    | Required | Default | Rules                                                                                                                       |
| -------- | ------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `page`   | integer | no       | `1`     | ≥ 1. Unparseable → default                                                                                                  |
| `limit`  | integer | no       | `10`    | 1…50. Out of range → default, **not** clamped                                                                               |
| `status` | enum    | no       | —       | `draft` \| `generating` \| `generated` \| `failed`. Empty string means no filter; an unknown value is **rejected with 400** |

**`200`**

```json
{
  "trips": [
    {
      "id": "cmf3k9x2b0000v8mc4h7q1abc",
      "userId": "cmf3k9x2b0000v8mc4h7q1xyz",
      "title": "Summer in Paris",
      "destination": "Paris",
      "country": "France",
      "startDate": "2026-06-10T00:00:00.000Z",
      "endDate": "2026-06-14T00:00:00.000Z",
      "daysCount": 5,
      "imageUrl": "https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg",
      "budgetMin": 500,
      "budgetMax": 1500,
      "budgetCurrency": "USD",
      "interests": ["Museums", "Food"],
      "status": "generated",
      "createdAt": "2026-05-02T09:14:33.120Z",
      "updatedAt": "2026-05-02T09:16:01.884Z"
    }
  ],
  "pagination": {
    "totalCount": 37,
    "totalPages": 4,
    "currentPage": 1,
    "limit": 10
  }
}
```

Days and activities are **not** included here — only `GET /trips/:id` returns
them.

```bash
curl -i -H "Cookie: authjs.session-token=<SESSION_TOKEN>" \
  "http://localhost:3001/api/v1/trips?status=generated&page=1&limit=10"
```

| Error | When                                   | Body                    |
| ----- | -------------------------------------- | ----------------------- |
| `400` | `status` is not one of the four values | Message from the schema |
| `401` | No valid session                       | Standard error shape    |

**Notes.** Read-only, no side effects, not rate limited. Ordered by
`createdAt` descending, served by a composite index on `(userId, createdAt)`.

---

### `GET /api/v1/trips/{id}`

Read one trip with its itinerary. Days sorted by number, activities sorted by
order. Ownership is part of the lookup, so an id owned by another user is
indistinguishable from one that does not exist.

Source: [`api/src/trips/trips.controller.ts:106`](../api/src/trips/trips.controller.ts#L106) ·
service [`trips.service.ts:44`](../api/src/trips/trips.service.ts#L44)

| Path parameter | Type   | Rules                                      |
| -------------- | ------ | ------------------------------------------ |
| `id`           | string | cuid. Anything else is rejected with `400` |

**`200`** — every field of `GET /trips`, plus:

```json
{
  "id": "cmf3k9x2b0000v8mc4h7q1abc",
  "destination": "Paris",
  "status": "generated",
  "tripDays": [
    {
      "id": "cmf3k9x2b0000v8mc4h7q1day",
      "tripId": "cmf3k9x2b0000v8mc4h7q1abc",
      "dayNumber": 1,
      "date": "2026-06-10T00:00:00.000Z",
      "summary": "Classic first day: the Louvre, then the Seine at dusk.",
      "activities": [
        {
          "id": "cmf3k9x2b0000v8mc4h7q1act",
          "dayId": "cmf3k9x2b0000v8mc4h7q1day",
          "title": "Louvre Museum",
          "description": "World-famous art museum in a former royal palace.",
          "time": "09:00",
          "placeName": "Louvre Museum",
          "placeType": "Museum",
          "latitude": 48.8606,
          "longitude": 2.3376,
          "estimatedCostCents": 2200,
          "estimatedCostCurrency": "EUR",
          "estimatedCostIsFree": false,
          "order": 1,
          "userOrder": null
        }
      ]
    }
  ]
}
```

Field notes, all from the schema:

- `latitude` and `longitude` are set together or not at all.
- `estimatedCostCents` is money in **minor units**, parsed once on ingestion.
  `estimatedCostIsFree` is a separate signal from a cost of zero being unknown.
- `order` is the generated position; `userOrder` is what the user dragged it
  to, kept apart so a regenerated itinerary does not inherit an arrangement of
  activities that no longer exist.
- `tripDays` is `[]` for a trip that has not finished generating.

```bash
curl -i -H "Cookie: authjs.session-token=<SESSION_TOKEN>" \
  http://localhost:3001/api/v1/trips/cmf3k9x2b0000v8mc4h7q1abc
```

| Error | When                                        | Body                          |
| ----- | ------------------------------------------- | ----------------------------- |
| `400` | `id` is not a cuid                          | `Trip ID is invalid`          |
| `401` | No valid session                            | Standard error shape          |
| `404` | No such trip, or it belongs to another user | `No trip found for this user` |

**Notes.** Read-only, not rate limited. One query with a nested include; no
transaction needed.

---

### `PATCH /api/v1/trips/{id}`

Rename a trip. Title only — the destination an itinerary was generated from
cannot be changed, so renaming never invalidates the plan.

Source: [`api/src/trips/trips.controller.ts:195`](../api/src/trips/trips.controller.ts#L195) ·
service [`trips.service.ts:74`](../api/src/trips/trips.service.ts#L74)

| Path parameter | Type   | Rules |
| -------------- | ------ | ----- |
| `id`           | string | cuid  |

| Body field | Type   | Required | Rules                                                                  |
| ---------- | ------ | -------- | ---------------------------------------------------------------------- |
| `title`    | string | **yes**  | Trimmed, then 1…120 characters. A value of only whitespace is rejected |

The id is **not** repeated in the body — it comes from the path.

```json
{ "title": "Summer in Paris" }
```

**`204`** — no body.

```bash
curl -i -X PATCH \
  -H "Cookie: authjs.session-token=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Summer in Paris"}' \
  http://localhost:3001/api/v1/trips/cmf3k9x2b0000v8mc4h7q1abc
```

| Error | When                                                          | Body                                                         |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| `400` | `id` is not a cuid, or `title` is empty / over 120 characters | Message from the schema                                      |
| `401` | No valid session                                              | Standard error shape                                         |
| `404` | No such trip, or it belongs to another user                   | `No trip found for this user`                                |
| `429` | More than 20 renames in a minute                              | `Too many requests. Please try again later.` + `Retry-After` |

**Notes.** Idempotent — sending the same title twice leaves the same state. One
`updateMany` scoped by owner, so no read-then-write race. No transaction, no
cache to invalidate, no webhook.

---

### `DELETE /api/v1/trips/{id}`

Delete a trip. Days and activities go with it through the schema cascade.

Source: [`api/src/trips/trips.controller.ts:149`](../api/src/trips/trips.controller.ts#L149) ·
service [`trips.service.ts:60`](../api/src/trips/trips.service.ts#L60)

| Path parameter | Type   | Rules |
| -------------- | ------ | ----- |
| `id`           | string | cuid  |

**`204`** — no body.

```bash
curl -i -X DELETE \
  -H "Cookie: authjs.session-token=<SESSION_TOKEN>" \
  http://localhost:3001/api/v1/trips/cmf3k9x2b0000v8mc4h7q1abc
```

| Error | When                                        | Body                                                         |
| ----- | ------------------------------------------- | ------------------------------------------------------------ |
| `400` | `id` is not a cuid                          | `Trip ID is invalid`                                         |
| `401` | No valid session                            | Standard error shape                                         |
| `404` | No such trip, or it belongs to another user | `No trip found for this user`                                |
| `429` | More than 20 deletes in a minute            | `Too many requests. Please try again later.` + `Retry-After` |

**Notes.** **Not** idempotent in its status: the first call answers `204`, a
repeat answers `404`. Cascading deletes remove `Day` and `Activity` rows; that
cascade is enforced by the database, not by application code.

---

## generation

### `GET /api/v1/trips/{id}/generation`

Itinerary generation status. Polled by the trip page while a trip is being
generated. Reads one column, so it is cheap enough to call on a schedule.

Source: [`api/src/trips/generation.controller.ts:36`](../api/src/trips/generation.controller.ts#L36) ·
service [`generation.service.ts:9`](../api/src/trips/generation.service.ts#L9)

| Path parameter | Type   | Rules |
| -------------- | ------ | ----- |
| `id`           | string | cuid  |

**`200`**

```json
{ "status": "generating" }
```

| Value        | Meaning                         |
| ------------ | ------------------------------- |
| `draft`      | Created, generation not started |
| `generating` | Claimed by a background run     |
| `generated`  | Itinerary written               |
| `failed`     | Every retry spent               |

The web client stops polling on `generated` or `failed`.

```bash
curl -i -H "Cookie: authjs.session-token=<SESSION_TOKEN>" \
  http://localhost:3001/api/v1/trips/cmf3k9x2b0000v8mc4h7q1abc/generation
```

| Error | When                                        | Body                          |
| ----- | ------------------------------------------- | ----------------------------- |
| `400` | `id` is not a cuid                          | `Trip ID is invalid`          |
| `401` | No valid session                            | Standard error shape          |
| `404` | No such trip, or it belongs to another user | `No trip found for this user` |

**Notes.** Read-only, not rate limited — it is designed to be called
repeatedly. Starting a generation is **not** part of this API: it still happens
through the Next.js server actions in
[`lib/actions/trip.actions.ts`](../lib/actions/trip.actions.ts).

---

## Open questions

Things the code does not settle. Each needs a decision before this document can
claim to be complete.

| #   | Question                                           | Why it is open                                                                                                                                                                                                                              |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Is there a deployed environment?**               | `openapi.json` lists only `http://localhost:3001`. A production or staging URL has to be added to `addServer()` in [`api/src/openapi.ts`](../api/src/openapi.ts) once one exists — inventing one now would put a false base URL in the docs |
| 2   | **Should `POST /trips/:id/generation` move here?** | The route exists in the Next app ([`app/api/trips/[id]/generation/route.ts`](../app/api/trips/%5Bid%5D/generation/route.ts)) and is documented in the root README, but nothing calls it. It is not part of this API                         |
| 3   | **Which endpoints stay in Next?**                  | Creating, retrying and reordering trips, all Live Guide operations, geocoding and place search are still Next server actions. They are out of scope here, but a reader may expect them                                                      |
| 4   | **Session cache window**                           | 30 seconds is a guess, not a requirement. It sets how long a signed-out user keeps access to this API                                                                                                                                       |
| 5   | **`409 Conflict`**                                 | The exception filter maps Prisma `P2002` to it, but no current route can violate a unique constraint. Left undocumented per endpoint on purpose                                                                                             |
| 6   | **Bearer token lifetime**                          | The bearer scheme carries the session token, so its lifetime is the session's. No separate issuance or revocation exists — confirm that is intended before anyone builds a non-browser client                                               |

## Keeping this in sync

Swagger decorators and this file describe the same thing, and nothing enforces
that. When a route changes:

1. update the decorators in the controller;
2. run `npm run docs:openapi -w api`;
3. update the matching section here.

Two places are especially easy to let drift, because Swagger cannot read a Zod
schema and the constraints are therefore written twice:

- `@ApiQuery` on `GET /trips` versus `listTripsQuerySchema`;
- `@ApiBody` on `PATCH /trips/:id` versus `tripTitleSchema`.

Both live in [`api/src/trips/trips.schema.ts`](../api/src/trips/trips.schema.ts).
