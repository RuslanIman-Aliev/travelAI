import { Prisma } from "@prisma/client";
import { formSchema } from "./validators";
import z from "zod";

export type DayWithActivities = Prisma.DayGetPayload<{
  include: { activities: true };
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

export interface AIActivity {
  time?: string;
  title?: string;
  placeName?: string;
  placeType?: string;
  description?: string;
  latitude?: number | string;
  longitude?: number | string;
  estimatedCost?: string;
  ticket_pricing?: string;
}

export interface AIDay {
  dayNumber: number;
  date: string;
  summary: string;
  activities: AIActivity[];
}
