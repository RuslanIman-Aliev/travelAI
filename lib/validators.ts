import z from "zod";

/** Longest trip we are willing to send to the model, in days. */
export const MAX_TRIP_DAYS = 30;
/** Upper bound on activities we accept for a single day from the model. */
export const MAX_ACTIVITIES_PER_DAY = 20;
/** Largest page size a caller may request from a paginated action. */
export const MAX_PAGE_SIZE = 50;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
    (trip) =>
      (trip.endDate.getTime() - trip.startDate.getTime()) / MS_PER_DAY <=
      MAX_TRIP_DAYS,
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
  isGenerated: z.boolean().optional(),
});

/**
 * Guards every paginated action. Without it a caller can request a negative page
 * (producing a negative Prisma `skip`) or an unbounded page size.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(10),
});

export const tripIdSchema = z.cuid("Trip ID is invalid");

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const liveGuideRouteSchema = z.object({
  location: z.string().min(1).max(300),
  coords: coordinatesSchema,
  radiusNumber: z.number().int().positive().max(100_000),
  selectedPlaces: z.array(liveGuidePlaceSchema).min(1).max(10),
  mapLink: z.url(),
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
  placeType: z.enum([
    "Sightseeing",
    "Food",
    "Relax",
    "Adventure",
    "Shopping",
    "Culture",
  ]),
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
export const aiTripResponseSchema = z.object({
  title: z.string().optional(),
  currency: z.string().optional(),
  itinerary: z.array(aiDaySchema).min(1).max(MAX_TRIP_DAYS),
});
