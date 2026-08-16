"use server";

import { GooglePlaceForLive, MappedPlace } from "../types";

const SEARCH_NEARBY_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

const INCLUDED_TYPES = [
  "tourist_attraction",
  "museum",
  "art_gallery",
  "historical_landmark",
  "restaurant",
  "cafe",
  "park",
];

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.primaryType",
  "places.rating",
  "places.userRatingCount",
  "places.location",
].join(",");

const EARTH_RADIUS_KM = 6371;

export type NearbyPlacesResult =
  | { success: true; places: MappedPlace[] }
  | { success: false; message: string };

/**
 * Turns a Places `primaryType` into a display label, e.g. `art_gallery` -> `Art Gallery`.
 *
 * @param {string} type - The raw place type from the API.
 * @returns {string} A human-readable category.
 */
function formatCategory(type: string): string {
  if (!type) return "General";
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Great-circle distance between two coordinate pairs (Haversine).
 *
 * @param {number} lat1 - Origin latitude.
 * @param {number} lon1 - Origin longitude.
 * @param {number} lat2 - Target latitude.
 * @param {number} lon2 - Target longitude.
 * @returns {number} Distance in kilometres, rounded to one decimal.
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return parseFloat((EARTH_RADIUS_KM * c).toFixed(1));
}

/**
 * Searches Google Places for points of interest around a coordinate.
 *
 * Uses a server-only key (never `NEXT_PUBLIC_`), and reports failures instead of
 * returning an empty list - the previous version made a rejected API key look
 * identical to "there is nothing near you".
 *
 * @param {number} lat - Search centre latitude.
 * @param {number} lng - Search centre longitude.
 * @param {number} radiusInMeters - Search radius in metres.
 * @returns {Promise<NearbyPlacesResult>} The mapped places, or a failure message.
 */
export async function getGoogleNearbyPlaces(
  lat: number,
  lng: number,
  radiusInMeters: number,
): Promise<NearbyPlacesResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_PLACES_API_KEY is not configured");
    return { success: false, message: "Place search is not configured." };
  }

  try {
    const response = await fetch(SEARCH_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: INCLUDED_TYPES,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusInMeters,
          },
        },
        rankPreference: "POPULARITY",
      }),
    });

    if (!response.ok) {
      console.error(
        "Google Places API error:",
        response.status,
        await response.text(),
      );
      return {
        success: false,
        message: "Could not reach the place search service.",
      };
    }

    const data = await response.json();

    const places: MappedPlace[] = (data.places ?? []).map(
      (place: GooglePlaceForLive) => ({
        id: place.id,
        name: place.displayName?.text || "Unknown Place",
        address: place.formattedAddress || "Address not available",
        category: formatCategory(place.primaryType),
        rating: place.rating ?? 0,
        userRatingCount: place.userRatingCount ?? 0,
        distance: calculateDistance(
          lat,
          lng,
          place.location.latitude,
          place.location.longitude,
        ),
        location: {
          lat: place.location.latitude,
          lng: place.location.longitude,
        },
      }),
    );

    return { success: true, places };
  } catch (error) {
    console.error("Error fetching Google places:", error);
    return {
      success: false,
      message: "Could not reach the place search service.",
    };
  }
}
