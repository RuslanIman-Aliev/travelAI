"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { insertTripSchema, userTripsFilterSchema } from "@/lib/validators";
import { prisma } from "@/prisma";
import z from "zod";
import { formatError } from "../utils";
import { checkRateLimit } from "../security";

/**
 * Retrieves the ID of the currently authenticated user.
 *
 * @returns {Promise<string>} A promise that resolves to the authenticated user's ID.
 * @throws {Error} If the user is unauthenticated or the session is invalid.
 */
const getAuthenticatedUserId = async () => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
};

/**
 * Creates a new trip in the database for the authenticated user.
 * Includes rate limiting checks to prevent abuse.
 *
 * @param {z.infer<typeof insertTripSchema>} data - The trip data conforming to the insertTripSchema.
 * @returns {Promise<{success: boolean, message: string, tripId?: string}>} The result of the operation containing a success flag, message, and potentially the newly created trip ID.
 */
export async function insertTrip(data: z.infer<typeof insertTripSchema>) {
  try {
    const userId = await getAuthenticatedUserId();
    const rateLimit = checkRateLimit(`insert-trip:${userId}`, {
      limit: 5,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new Error(
        "Too many trip creation requests. Please try again later.",
      );
    }

    const tripData = insertTripSchema.parse(data);
    const budget = tripData.budget?.toString().replace(",", "-");
    const differenceInTime =
      tripData.endDate.getTime() - tripData.startDate.getTime();
    const daysCount = Math.ceil(differenceInTime / (1000 * 3600 * 24)) + 1;

    const newTrip = await prisma.trip.create({
      data: {
        destination: tripData.destination,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        interests: tripData.interests,
        country: tripData.country,
        budget,
        daysCount,
        userId,
      },
    });

    revalidatePath("/");

    return {
      success: true,
      message: "Trip created successfully",
      tripId: newTrip.id,
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error) || "An unexpected error occurred",
    };
  }
}

/**
 * Retrieves a specific trip by its ID, complete with days and associated activities.
 * Validates that the trip belongs to the currently authenticated user.
 *
 * @param {string} tripId - The unique identifier of the trip to retrieve.
 * @returns {Promise<{success: boolean, message?: string, trip?: any}>} The result of the operation containing a success flag, and optionally the trip data or an error message.
 */
export const getTripById = cache(async (tripId: string) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "User not found" };
    }
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: session.user.id,
      },
      include: {
        tripDays: {
          orderBy: {
            dayNumber: "asc",
          },
          include: {
            activities: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
      },
    });
    if (!trip) {
      return { success: false, message: "Trip not found" };
    }

    return { success: true, trip };
  } catch (error) {
    return {
      success: false,
      message: formatError(error) || "An unexpected error occurred",
    };
  }
});

/**
 * Retrieves all trips associated with the currently authenticated user.
 * Supports optional filtering by trip status and generation source, as well as pagination.
 *
 * @param {string} [status] - Optional filter for the trip's status.
 * @param {boolean} [isGenerated] - Optional filter to check if the trip was AI-generated.
 * @param {number} [page=1] - The page number to retrieve.
 * @param {number} [limit=10] - The number of items per page.
 * @returns {Promise<{success: boolean, message?: string, trips?: any[], pagination?: any}>} The result of the operation containing trips and pagination metadata.
 */
export const getUserTrips = cache(
  async (
    status?: string,
    isGenerated?: boolean,
    page: number = 1,
    limit: number = 10,
  ) => {
    try {
      const userId = await getAuthenticatedUserId();
      const filters = userTripsFilterSchema.parse({
        status: status?.trim() || undefined,
        isGenerated,
      });

      const skip = (page - 1) * limit;

      const [trips, totalCount] = await Promise.all([
        prisma.trip.findMany({
          where: {
            userId,
            status: filters.status,
            aiGenerated: filters.isGenerated,
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.trip.count({
          where: {
            userId,
            status: filters.status,
            aiGenerated: filters.isGenerated,
          },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        trips,
        pagination: {
          totalCount,
          totalPages,
          currentPage: page,
          limit,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: formatError(error) || "An unexpected error occurred",
      };
    }
  },
);

/**
 * Aggregates statistics for the user's AI-generated trips.
 * Calculates total trip count, distinct countries visited, and unique cities queried.
 *
 * @returns {Promise<{success: boolean, message?: string, tripsCount?: number, countries?: number, cities?: number}>} The result of the operation including the calculated metrics.
 */
export const getUserStatictics = cache(async () => {
  try {
    const userId = await getAuthenticatedUserId();
    const [tripsCount, countries, cities] = await Promise.all([
      prisma.trip.count({
        where: {
          userId,
          aiGenerated: true,
        },
      }),
      prisma.trip.findMany({
        where: {
          userId,
          aiGenerated: true,
        },
        distinct: ["country"],
        select: {
          country: true,
        },
      }),
      prisma.trip.findMany({
        where: {
          userId,
          aiGenerated: true,
        },
        distinct: ["destination"],
        select: {
          destination: true,
        },
      }),
    ]);

    return {
      success: true,
      tripsCount,
      countries: countries.length,
      cities: cities.length,
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error) || "An unexpected error occurred",
    };
  }
});
