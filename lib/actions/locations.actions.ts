"use server";

import { requireUserId } from "@/auth";
import { checkRateLimit } from "../security";
import { coordinatesSchema } from "../validators";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

/** Subset of the Nominatim reverse-geocode response the UI actually reads. */
export type ReverseGeocodeAddress = {
  road?: string;
  house_number?: string;
  town?: string;
  city?: string;
  country?: string;
};

/**
 * Reverse-geocodes coordinates through Nominatim.
 *
 * Rate limited per user because Nominatim's usage policy caps callers at roughly
 * one request per second, and this action proxies an outbound request on behalf
 * of anyone who is signed in.
 *
 * @param {number} lat - The latitude coordinate.
 * @param {number} lng - The longitude coordinate.
 * @returns {Promise<ReverseGeocodeAddress|null>} The address parts, or null on failure.
 */
export async function getAddressFromCoordinates(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeAddress | null> {
  try {
    const userId = await requireUserId();

    const rateLimit = checkRateLimit(`reverse-geocode:${userId}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) return null;

    const parsed = coordinatesSchema.parse({ lat, lng });
    const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${parsed.lat}&lon=${parsed.lng}&accept-language=en`;

    const response = await fetch(url, {
      headers: {
        // Nominatim requires an identifying contact; keep it out of source.
        "User-Agent": `TravelGuideApp/1.0 (${
          process.env.NOMINATIM_CONTACT ?? "contact-not-configured"
        })`,
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();
    return (data?.address as ReverseGeocodeAddress) ?? null;
  } catch (error) {
    console.error("Failed to fetch address:", error);
    return null;
  }
}
