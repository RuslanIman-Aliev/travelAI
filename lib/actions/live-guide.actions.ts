"use server";

import { requireUserId } from "@/auth";
import { prisma } from "@/prisma";
import { UserFacingError } from "../errors";
import { checkRateLimit } from "../security";
import { LiveRouteData } from "../types";
import { formatError } from "../utils";
import { liveGuideRouteSchema } from "../validators";

/**
 * Saves a live guide route to the database for the authenticated user.
 * Validates the session, enforces rate limits, and parses incoming data before creation.
 * Authorization, rate-limiting, validation, and persistence failures are reported
 * in the returned object rather than being thrown to the caller.
 *
 * @param {LiveRouteData} data - The live route data including location, coordinates, radius, map link, and selected places.
 * @returns {Promise<{success: boolean, message?: string}>} An object indicating success and optionally providing an error message.
 */
export async function saveLiveGuideRoute(data: LiveRouteData) {
  try {
    const userId = await requireUserId();

    const rateLimit = checkRateLimit(`live-guide:${userId}`, {
      limit: 5,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new UserFacingError(
        "Too many live guide requests. Please try again later.",
      );
    }

    const { location, coords, radiusNumber, selectedPlaces, mapLink } =
      liveGuideRouteSchema.parse(data);

    await prisma.liveGuide.create({
      data: {
        userId,
        startAddress: location,
        startLat: coords.lat,
        startLng: coords.lng,
        mapLink,
        radiusMeters: radiusNumber,
        places: {
          create: selectedPlaces.map((place, index) => ({
            googlePlaceId: place.id,
            name: place.name,
            address: place.address,
            category: place.category,
            rating: place.rating,
            userRatingCount: place.userRatingCount,
            lat: place.location.lat,
            lng: place.location.lng,
            distance: place.distance,
            orderIndex: index,
          })),
        },
      },
      select: { id: true },
    });

    return { success: true as const };
  } catch (error) {
    return { success: false as const, message: formatError(error) };
  }
}
