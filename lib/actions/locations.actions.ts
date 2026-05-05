"use server";

import { coordinatesSchema } from "../validators";

/**
 * Retrieves the address corresponding to the provided latitude and longitude using the Nominatim OpenStreetMap API.
 * Validates the coordinates to ensure they format correctly before the request.
 *
 * @param {number} lat - The latitude coordinate.
 * @param {number} lng - The longitude coordinate.
 * @returns {Promise<any|null>} The parsed JSON data containing address details, or null if an error occurs.
 */
export async function getAddressFromCoordinates(lat: number, lng: number) {
  try {
    const parsed = coordinatesSchema.parse({ lat, lng });
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${parsed.lat}&lon=${parsed.lng}&accept-language=en`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "TravelGuideApp/1.0 s0970802047@gmail.com",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch address:", error);
    return null;
  }
}
