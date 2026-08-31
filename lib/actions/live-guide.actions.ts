"use server";

import { requireUserId } from "@/auth";
import { prisma } from "@/prisma";
import { UserFacingError } from "../errors";
import { checkRateLimit } from "../security";
import { LiveRouteData } from "../types";
import { formatError } from "../utils";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import {
  liveGuideIdSchema,
  liveGuideRouteSchema,
  paginationSchema,
} from "../validators";

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

/**
 * Lists the caller's saved Live Guide routes, newest first.
 *
 * The counterpart that was missing: `LiveGuide` and `LiveGuidePlace` were
 * written on every save and read nowhere, so two models with cascades and
 * indexes served data no user could ever see.
 *
 * @param {number} [page=1] - The page to retrieve.
 * @param {number} [limit=10] - Routes per page.
 * @returns {Promise<{success: boolean, message?: string, routes?: object[], pagination?: object}>} The routes and pagination metadata.
 */
export const getUserLiveGuides = cache(
  async (page: number = 1, limit: number = 10) => {
    try {
      const userId = await requireUserId();
      const pagination = paginationSchema.parse({ page, limit });

      const where = { userId };

      const [routes, totalCount] = await Promise.all([
        prisma.liveGuide.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
          include: { places: { orderBy: { orderIndex: "asc" } } },
        }),
        prisma.liveGuide.count({ where }),
      ]);

      return {
        success: true as const,
        routes,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / pagination.limit),
          currentPage: pagination.page,
          limit: pagination.limit,
        },
      };
    } catch (error) {
      return { success: false as const, message: formatError(error) };
    }
  },
);

/**
 * Deletes one of the caller's saved routes. Its places go with it through the
 * schema's cascade.
 *
 * @param {string} routeId - The route to delete.
 * @returns {Promise<{success: boolean, message: string}>} The result of the operation.
 */
export async function deleteLiveGuideRoute(routeId: string) {
  try {
    const userId = await requireUserId();

    const rateLimit = checkRateLimit(`delete-live-guide:${userId}`, {
      limit: 20,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new UserFacingError(
        "Too many delete requests. Please try again later.",
      );
    }

    const id = liveGuideIdSchema.parse(routeId);

    // Scoped by owner, so somebody else's id deletes nothing rather than
    // throwing - the caller learns only that it did not match.
    const deleted = await prisma.liveGuide.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      throw new UserFacingError("Route not found");
    }

    revalidatePath("/live-guide/history");

    return { success: true as const, message: "Route deleted" };
  } catch (error) {
    return { success: false as const, message: formatError(error) };
  }
}
