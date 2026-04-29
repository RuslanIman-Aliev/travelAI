import z from "zod";

// Define a Zod schema for a Trip Details

const tripStatusSchema = z.enum(["draft", "generated", "failed"]);

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

export const insertTripSchema = z.object({
  destination: z.string().min(1, "Destination is required"),
  country: z.string().min(1, "Country is required"),
  startDate: z.date(),
  endDate: z.date(),
  interests: z.array(z.string()).optional(),
  budget: z.array(z.number()).min(2).max(2).optional(),
});

export const userTripsFilterSchema = z.object({
  status: z
    .union([tripStatusSchema, z.literal("")])
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  isGenerated: z.boolean().optional(),
});

export const startTripRequestSchema = z.object({
  tripId: z.string().cuid("Trip ID is invalid"),
});

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const liveGuideRouteSchema = z.object({
  location: z.string().min(1),
  coords: coordinatesSchema,
  radiusNumber: z.number().int().positive(),
  selectedPlaces: z.array(liveGuidePlaceSchema).min(1).max(10),
  mapLink: z.string().url(),
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
    .min(1, { message: "Select at least one place to visit" }),
});

const aiActivitySchema = z.object({
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

export const aiTripResponseSchema = z.object({
  title: z.string().optional(),
  currency: z.string().optional(),
  itinerary: z
    .array(
      z.object({
        dayNumber: z.number().int().min(1),
        date: z.string().min(1),
        summary: z.string().optional().default(""),
        activities: z.array(aiActivitySchema).min(1),
      }),
    )
    .min(1),
});
