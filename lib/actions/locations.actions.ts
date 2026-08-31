"use server";

import { requireUserId } from "@/auth";
import { checkRateLimit } from "../security";
import { coordinatesSchema } from "../validators";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/** Subset of a reverse-geocode result the UI actually reads. */
export type ReverseGeocodeAddress = {
  road?: string;
  house_number?: string;
  town?: string;
  city?: string;
  country?: string;
};

/**
 * What a reverse-geocode attempt produced.
 *
 * `rate-limited` is separate from `error` because they need different words in
 * the UI: one is "wait a moment", the other is "something went wrong". Returning
 * `null` for both told a user who had simply clicked too fast that their
 * location could not be determined at all.
 */
export type ReverseGeocodeResult =
  | { success: true; address: ReverseGeocodeAddress }
  | { success: false; reason: "rate-limited"; retryAfterMs: number }
  | { success: false; reason: "error" };

type GeocodeComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

/**
 * Reduces Google's flat `address_components` list to the parts the form shows.
 *
 * Google returns one entry per component, each tagged with the roles it plays,
 * rather than the pre-keyed object Nominatim produced. `postal_town` is checked
 * before `locality` for `town` because that is the field UK addresses populate.
 *
 * @param {GeocodeComponent[]} components - Components from the first result.
 * @returns {ReverseGeocodeAddress} The parts the UI formats into one line.
 */
const toAddress = (components: GeocodeComponent[]): ReverseGeocodeAddress => {
  const find = (type: string) =>
    components.find((component) => component.types?.includes(type))?.long_name;

  return {
    house_number: find("street_number"),
    road: find("route"),
    town: find("postal_town") ?? find("administrative_area_level_3"),
    city: find("locality") ?? find("administrative_area_level_2"),
    country: find("country"),
  };
};

/**
 * Reverse-geocodes coordinates through the Google Geocoding API.
 *
 * This used to call Nominatim, whose usage policy caps callers at roughly one
 * request per second and restricts commercial use - while the Places key this
 * project already pays for covers geocoding on the same account. One vendor
 * fewer, one contract fewer, and a rate limit that is ours rather than a
 * volunteer service's.
 *
 * Still rate limited per user: the key is billed per request, and this action is
 * a public endpoint like any other.
 *
 * @param {number} lat - The latitude coordinate.
 * @param {number} lng - The longitude coordinate.
 * @returns {Promise<ReverseGeocodeResult>} The address, or why it could not be resolved.
 */
export async function getAddressFromCoordinates(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  try {
    const userId = await requireUserId();

    const rateLimit = checkRateLimit(`reverse-geocode:${userId}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return {
        success: false,
        reason: "rate-limited",
        retryAfterMs: rateLimit.retryAfterMs,
      };
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_PLACES_API_KEY is not configured");
      return { success: false, reason: "error" };
    }

    const parsed = coordinatesSchema.parse({ lat, lng });
    const params = new URLSearchParams({
      latlng: `${parsed.lat},${parsed.lng}`,
      language: "en",
      // Street addresses only. Without this Google also returns plus codes,
      // postcodes and country-sized bounding boxes, and the first result is not
      // reliably the one a person would recognise as "where I am".
      result_type: "street_address|route|premise|locality",
      key: apiKey,
    });

    const response = await fetch(`${GEOCODE_URL}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    // A 200 with `status: "REQUEST_DENIED"` is how a key without the Geocoding
    // API enabled fails, so the HTTP code alone is not enough to trust.
    if (data?.status === "ZERO_RESULTS") {
      return { success: false, reason: "error" };
    }

    if (data?.status !== "OK") {
      throw new Error(
        `Geocoding API returned ${data?.status ?? "an unknown status"}`,
      );
    }

    const components = data?.results?.[0]?.address_components;
    if (!Array.isArray(components)) {
      return { success: false, reason: "error" };
    }

    return { success: true, address: toAddress(components) };
  } catch (error) {
    console.error("Failed to fetch address:", error);
    return { success: false, reason: "error" };
  }
}
