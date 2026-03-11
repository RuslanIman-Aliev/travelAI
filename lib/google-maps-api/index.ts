"use server";

import { GooglePlaceForLive, MappedPlace } from "../types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAP_API;

export async function getGoogleNearbyPlaces(
  lat: number,
  lng: number,
  radiusInMeters: number,
): Promise<MappedPlace[]> {
  try {
    const url = "https://places.googleapis.com/v1/places:searchNearby";
    // 1. Define the types of places to include
    const includedTypes = [
      "tourist_attraction",
      "museum",
      "art_gallery",
      "historical_landmark",
      "restaurant",
      "cafe",
      "park",
    ];

    // 2. Prepare the Request Body
    const requestBody = {
      includedTypes: includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: radiusInMeters,
        },
      },
      rankPreference: "POPULARITY",
    };

    // 3. Call the API
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY || "",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.primaryType,places.rating,places.userRatingCount,places.location",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Places API Error:", errorData);
      throw new Error("Failed to fetch places");
    }

    const data = await response.json();

    // 4. Map the data
    const places: MappedPlace[] = (data.places || []).map(
      (place: GooglePlaceForLive) => ({
        id: place.id,
        name: place.displayName?.text || "Unknown Place",
        address: place.formattedAddress || "Address not available",
        category: formatCategory(place.primaryType), // Helper function below
        rating: place.rating || 0,
        distance: calculateDistance(
          lat,
          lng,
          place.location.latitude,
          place.location.longitude,
        ),
        userRatingCount: place.userRatingCount || 0,
        location: {
          lat: place.location.latitude,
          lng: place.location.longitude,
        },
      }),
    );

    return places;
  } catch (error) {
    console.error("Error fetching Google places:", error);
    return [];
  }
}

// Helper to make categories look nice (e.g., "art_gallery" -> "Art Gallery")
function formatCategory(type: string): string {
  if (!type) return "General";
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return parseFloat(distance.toFixed(1));
}
