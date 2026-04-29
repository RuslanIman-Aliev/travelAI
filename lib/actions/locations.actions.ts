"use server";

import { coordinatesSchema } from "../validators";

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
