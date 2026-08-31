import z from "zod";
import { PLACE_TYPE_LABELS } from "./place-types";

/** Longest trip we are willing to send to the model, in days. */
export const MAX_TRIP_DAYS = 30;
/** Upper bound on activities we accept for a single day from the model. */
export const MAX_ACTIVITIES_PER_DAY = 20;
/** Largest page size a caller may request from a paginated action. */
export const MAX_PAGE_SIZE = 50;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * The single definition of "how many days is this trip", inclusive of both
 * endpoints. The validator, the persisted `daysCount` and the bounds on the
 * model response all have to agree on it - when they did not, a trip whose dates
 * spanned exactly `MAX_TRIP_DAYS + 1` days passed validation, asked the model for
 * one more day than the response schema allows, and failed to parse every time.
 *
 * Rounds rather than ceils: both endpoints are midnights, so the gap is a whole
 * number of days give or take an hour of DST, and ceiling that hour turned a
 * 30-day trip into 31.
 *
 * @param {Date} startDate - First day of the trip.
 * @param {Date} endDate - Last day of the trip.
 * @returns {number} Day count covering both endpoints.
 */
export const tripDaysCount = (startDate: Date, endDate: Date) =>
  Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

const tripStatusSchema = z.enum(["draft", "generating", "generated", "failed"]);

const liveGuidePlaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  category: z.string().min(1),
  rating: z.number(),
  userRatingCount: z.number().optional(),
  distance: z.number().optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

export const insertTripSchema = z
  .object({
    destination: z.string().min(1, "Destination is required").max(120),
    country: z.string().min(1, "Country is required").max(120),
    startDate: z.date(),
    endDate: z.date(),
    interests: z.array(z.string().max(60)).max(20).optional(),
    budget: z
      .array(z.number().int().min(0).max(1_000_000))
      .length(2)
      .optional(),
  })
  // Server actions are public endpoints, so the form is not the boundary: these
  // invariants have to hold even when the payload never touched the UI.
  .refine((trip) => trip.endDate >= trip.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })
  .refine(
    (trip) => tripDaysCount(trip.startDate, trip.endDate) <= MAX_TRIP_DAYS,
    {
      message: `Trips are limited to ${MAX_TRIP_DAYS} days`,
      path: ["endDate"],
    },
  )
  .refine((trip) => !trip.budget || trip.budget[0] <= trip.budget[1], {
    message: "Minimum budget cannot exceed maximum budget",
    path: ["budget"],
  });

export const userTripsFilterSchema = z.object({
  status: z
    .union([tripStatusSchema, z.literal("")])
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

/** Protocols a stored link may use when something later renders it as an href. */
const SAFE_URL_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * A link that is safe to put in an `href`.
 *
 * `z.url()` alone is not that check: in Zod 4 it validates the shape of a URL and
 * accepts any protocol, so `javascript:alert(1)` passes it. Nothing renders these
 * links today, which is the only reason it was not already an XSS - this closes
 * it at the boundary rather than relying on that staying true.
 */
export const webUrlSchema = z.url().refine(
  (value) => {
    try {
      return SAFE_URL_PROTOCOLS.has(new URL(value).protocol);
    } catch {
      return false;
    }
  },
  { message: "Link must be an http or https URL" },
);

/**
 * Guards every paginated action. Without it a caller can request a negative page
 * (producing a negative Prisma `skip`) or an unbounded page size.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(10),
});

export const tripIdSchema = z.cuid("Trip ID is invalid");

export const liveGuideIdSchema = z.cuid("Route ID is invalid");

/**
 * A saved arrangement of one day. The list has to be the day's full set of
 * activities: a partial list would leave the rest with stale positions, and a
 * list with duplicates would give two activities the same one.
 */
export const reorderDaySchema = z.object({
  dayId: z.cuid("Day ID is invalid"),
  activityIds: z
    .array(z.cuid("Activity ID is invalid"))
    .min(1)
    .max(MAX_ACTIVITIES_PER_DAY)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "An activity cannot appear twice in one day",
    }),
});

/** Longest trip name a user may set. */
export const MAX_TRIP_TITLE_LENGTH = 120;

export const renameTripSchema = z.object({
  tripId: tripIdSchema,
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(
      MAX_TRIP_TITLE_LENGTH,
      `Title must be ${MAX_TRIP_TITLE_LENGTH} characters or fewer`,
    ),
});

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Ceiling on a Places search radius, in metres. Google's `searchNearby` rejects
 * anything above this, and it also bounds what a caller can ask a billed API to
 * scan on our key.
 */
export const MAX_PLACES_RADIUS_METERS = 50_000;

/** Input accepted by the nearby-places search. */
export const nearbyPlacesSearchSchema = coordinatesSchema.extend({
  radiusInMeters: z.number().positive().max(MAX_PLACES_RADIUS_METERS),
});

export const liveGuideRouteSchema = z.object({
  location: z.string().min(1).max(300),
  coords: coordinatesSchema,
  radiusNumber: z.number().int().positive().max(100_000),
  selectedPlaces: z.array(liveGuidePlaceSchema).min(1).max(10),
  mapLink: webUrlSchema,
});

export const formSchema = z.object({
  location: z.string().min(1, {
    message: "Choose a location by clicking a Use Current Location button",
  }),
  radius: z.string().min(1, { message: "Radius is required" }),
  selectedPlaces: z
    .array(
      z.object({
        id: z.string(),
        address: z.string(),
        name: z.string(),
        category: z.string(),
        rating: z.number(),
        distance: z.number().optional(),
        userRatingCount: z.number(),
        location: z.object({
          lat: z.number(),
          lng: z.number(),
        }),
      }),
    )
    .min(1, { message: "Select at least one place to visit" })
    .max(10, { message: "Select at most 10 places" }),
});

export const aiActivitySchema = z.object({
  time: z.string().min(1),
  title: z.string().optional(),
  placeName: z.string().optional(),
  // Straight from the canonical list, so the model can only return a type the
  // UI knows how to draw.
  placeType: z.enum(PLACE_TYPE_LABELS),
  description: z.string().min(1),
  latitude: z.union([z.number(), z.string()]),
  longitude: z.union([z.number(), z.string()]),
  estimatedCost: z.string().min(1).optional(),
  ticket_pricing: z.string().min(1).optional(),
});

export const aiDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(MAX_TRIP_DAYS),
  date: z.string().min(1),
  summary: z.string().optional().default(""),
  activities: z.array(aiActivitySchema).min(1).max(MAX_ACTIVITIES_PER_DAY),
});

// The model is untrusted input like any other client: bound the response so a
// hallucinated itinerary cannot turn into thousands of rows.
//
// `title` and `currency` are no longer requested by the prompt (nothing persists
// them) but stay optional here so an in-flight response still parses.
export const aiTripResponseSchema = z.object({
  title: z.string().optional(),
  currency: z.string().optional(),
  itinerary: z.array(aiDaySchema).min(1).max(MAX_TRIP_DAYS),
});

/** The escape hatch the prompt defines for an unrecognisable destination. */
export const aiErrorResponseSchema = z.object({
  error: z.string().min(1),
});

/**
 * What the model is allowed to return.
 *
 * This drives constrained decoding via `responseJsonSchema`, so the error variant
 * has to be part of it: constraining output to the itinerary shape alone would
 * make `{ "error": "Location not found" }` unrepresentable and silently break the
 * invalid-destination path.
 */
export const aiGenerationResponseSchema = z.union([
  aiErrorResponseSchema,
  aiTripResponseSchema,
]);
