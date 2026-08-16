import { Prisma } from "@prisma/client";
import z from "zod";
import {
  aiActivitySchema,
  aiDaySchema,
  aiTripResponseSchema,
  formSchema,
} from "./validators";

export type DayWithActivities = Prisma.DayGetPayload<{
  include: { activities: true };
}>;

export type TripWithDays = Prisma.TripGetPayload<{
  include: { tripDays: { include: { activities: true } } };
}>;

export interface GooglePlace {
  id: string;
  name: string;
  address: string;
  category: string;
  rating: number;
  userRatingCount?: number;
  location: {
    lat: number;
    lng: number;
  };
  distance?: number;
}

export interface LiveRouteData {
  location: string;
  coords: { lat: number; lng: number };
  radiusNumber: number;
  selectedPlaces: GooglePlace[];
  mapLink: string;
}

/** Raw shape returned by the Google Places `searchNearby` endpoint. */
export interface GooglePlaceForLive {
  id: string;
  displayName?: {
    text: string;
  };
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  primaryType: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

/** Our normalised view of a nearby place, used across the Live Guide UI. */
export interface MappedPlace {
  id: string;
  name: string;
  address: string;
  category: string;
  rating: number;
  userRatingCount: number;
  distance?: number;
  location: {
    lat: number;
    lng: number;
  };
}

export type LiveGuideFormValues = z.infer<typeof formSchema>;

// Derived from the Zod schemas rather than hand-written, so the parsed value and
// its type can never drift apart (the old hand-written `placeType?: string`
// silently discarded the enum the schema already guarantees).
export type AIActivity = z.infer<typeof aiActivitySchema>;
export type AIDay = z.infer<typeof aiDaySchema>;
export type AITripResponse = z.infer<typeof aiTripResponseSchema>;
