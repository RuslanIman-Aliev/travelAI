"use server";

import { requireUserId } from "@/auth";
import {
  insertTripSchema,
  paginationSchema,
  userTripsFilterSchema,
} from "@/lib/validators";
import { BUDGET_CURRENCY } from "@/lib/variables";
import { prisma } from "@/prisma";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import z from "zod";
import { UserFacingError } from "../errors";
import { checkRateLimit } from "../security";
import { formatError } from "../utils";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Creates a new trip in the database for the authenticated user.
 * Includes rate limiting checks to prevent abuse.
 *
 * @param {z.infer<typeof insertTripSchema>} data - The trip data conforming to the insertTripSchema.
 * @returns {Promise<{success: boolean, message: string, tripId?: string}>} The result of the operation containing a success flag, message, and potentially the newly created trip ID.
 */
export async function insertTrip(data: z.infer<typeof insertTripSchema>) {
  try {
    const userId = await requireUserId();
    const rateLimit = checkRateLimit(`insert-trip:${userId}`, {
      limit: 5,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new UserFacingError(
        "Too many trip creation requests. Please try again later.",
      );
    }

    const tripData = insertTripSchema.parse(data);

    const differenceInTime =
      tripData.endDate.getTime() - tripData.startDate.getTime();
    const daysCount = Math.ceil(differenceInTime / MS_PER_DAY) + 1;

    const newTrip = await prisma.trip.create({
      data: {
        destination: tripData.destination,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        interests: tripData.interests ?? [],
        country: tripData.country,
        budgetMin: tripData.budget?.[0] ?? null,
        budgetMax: tripData.budget?.[1] ?? null,
        budgetCurrency: tripData.budget ? BUDGET_CURRENCY : null,
        daysCount,
        userId,
      },
      select: { id: true },
    });

    revalidatePath("/");

    return {
      success: true as const,
      message: "Trip created successfully",
      tripId: newTrip.id,
    };
  } catch (error) {
    return { success: false as const, message: formatError(error) };
  }
}

/**
 * Retrieves a specific trip by its ID, complete with days and associated activities.
 * Validates that the trip belongs to the currently authenticated user.
 *
 * @param {string} tripId - The unique identifier of the trip to retrieve.
 * @returns {Promise<{success: boolean, message?: string, trip?: object}>} The result of the operation containing a success flag, and optionally the trip data or an error message.
 */
export const getTripById = cache(async (tripId: string) => {
  try {
    const userId = await requireUserId();

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId },
      include: {
        tripDays: {
          orderBy: { dayNumber: "asc" },
          include: {
            activities: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!trip) {
      return { success: false as const, message: "Trip not found" };
    }

    return { success: true as const, trip };
  } catch (error) {
    return { success: false as const, message: formatError(error) };
  }
});

/**
 * Retrieves the authenticated user's trips, filtered by status and generation
 * source, with pagination.
 *
 * Page and limit are validated rather than trusted: this action is a public
 * endpoint, and an unchecked page produced a negative Prisma `skip`.
 *
 * @param {string} [status] - Optional filter for the trip's status.
 * @param {boolean} [isGenerated] - Optional filter to check if the trip was AI-generated.
 * @param {number} [page=1] - The page number to retrieve.
 * @param {number} [limit=10] - The number of items per page.
 * @returns {Promise<{success: boolean, message?: string, trips?: object[], pagination?: object}>} The result of the operation containing trips and pagination metadata.
 */
export const getUserTrips = cache(
  async (
    status?: string,
    isGenerated?: boolean,
    page: number = 1,
    limit: number = 10,
  ) => {
    try {
      const userId = await requireUserId();

      const filters = userTripsFilterSchema.parse({
        status: status?.trim() || undefined,
        isGenerated,
      });
      const pagination = paginationSchema.parse({ page, limit });

      const where = {
        userId,
        status: filters.status,
        aiGenerated: filters.isGenerated,
      };

      const [trips, totalCount] = await Promise.all([
        prisma.trip.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
        }),
        prisma.trip.count({ where }),
      ]);

      return {
        success: true as const,
        trips,
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
 * Aggregates statistics for the user's AI-generated trips: how many trips, how
 * many distinct countries, and how many distinct destinations.
 *
 * @returns {Promise<{success: boolean, message?: string, tripsCount?: number, countries?: number, cities?: number}>} The result of the operation including the calculated metrics.
 */
export const getUserStatistics = cache(async () => {
  try {
    const userId = await requireUserId();
    const where = { userId, aiGenerated: true };

    // `groupBy` counts the distinct values in the database instead of shipping
    // one row per trip back just to measure the array length.
    const [tripsCount, countries, cities] = await Promise.all([
      prisma.trip.count({ where }),
      prisma.trip.groupBy({ by: ["country"], where }),
      prisma.trip.groupBy({ by: ["destination"], where }),
    ]);

    return {
      success: true as const,
      tripsCount,
      countries: countries.filter((row) => row.country != null).length,
      cities: cities.length,
    };
  } catch (error) {
    return { success: false as const, message: formatError(error) };
  }
});
