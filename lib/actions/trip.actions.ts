"use server";

import { requireUserId } from "@/auth";
import {
  insertTripSchema,
  paginationSchema,
  renameTripSchema,
  reorderDaySchema,
  tripDaysCount,
  tripIdSchema,
  userTripsFilterSchema,
} from "@/lib/validators";
import { BUDGET_CURRENCY } from "@/lib/variables";
import { prisma } from "@/prisma";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import z from "zod";
import { toUtcDateOnly } from "../dates";
import { UserFacingError } from "../errors";
import { checkRateLimit } from "../security";
import { startTripGeneration } from "../trip-generation";
import { formatError } from "../utils";

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

    // The form already sends calendar days as UTC midnight; this floors anything
    // a direct caller sends, so what is stored is always a day and never an
    // instant that renders as the day before in another timezone.
    const startDate = toUtcDateOnly(tripData.startDate);
    const endDate = toUtcDateOnly(tripData.endDate);

    // Same helper the schema bounds the trip length with, so what is persisted
    // can never exceed what the model response is allowed to contain.
    const daysCount = tripDaysCount(startDate, endDate);

    const newTrip = await prisma.trip.create({
      data: {
        destination: tripData.destination,
        startDate,
        endDate,
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

    // Generation starts here, on the server, rather than from a `useEffect` on
    // the trip page. A browser that never loaded that page - a closed tab, a
    // failed navigation, a shared link opened later - used to leave the trip in
    // `draft` with nothing scheduled to pick it up.
    const generation = await startTripGeneration(newTrip.id, userId);

    revalidatePath("/");

    return {
      success: true as const,
      message:
        generation.status === "started"
          ? "Trip created successfully"
          : "Trip created, but generation could not be started. Open it to retry.",
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
 * A failure carries a `reason`: `not-found` means the row is genuinely absent or
 * belongs to somebody else, `error` means the lookup itself failed. Only the
 * first of those is a 404.
 *
 * @param {string} tripId - The unique identifier of the trip to retrieve.
 * @returns {Promise<{success: boolean, reason?: "not-found"|"error", message?: string, trip?: object}>} The trip, or the failure and why.
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
      return {
        success: false as const,
        reason: "not-found" as const,
        message: "Trip not found",
      };
    }

    return { success: true as const, trip };
  } catch (error) {
    // The caller needs these two apart. Collapsing them into one failure is why
    // a momentary Prisma outage told the user their trip did not exist.
    //
    // An unauthenticated caller stays on the `not-found` side on purpose: a
    // "something went wrong, try again" screen would confirm the id exists.
    const reason =
      error instanceof UserFacingError
        ? ("not-found" as const)
        : ("error" as const);

    return { success: false as const, reason, message: formatError(error) };
  }
});

/**
 * Retrieves the authenticated user's trips, filtered by status, with pagination.
 *
 * Page and limit are validated rather than trusted: this action is a public
 * endpoint, and an unchecked page produced a negative Prisma `skip`.
 *
 * The separate `isGenerated` filter is gone with the column behind it: it asked
 * the same question as `status === "generated"`, and the two could disagree.
 *
 * @param {string} [status] - Optional filter for the trip's status.
 * @param {number} [page=1] - The page number to retrieve.
 * @param {number} [limit=10] - The number of items per page.
 * @returns {Promise<{success: boolean, message?: string, trips?: object[], pagination?: object}>} The result of the operation containing trips and pagination metadata.
 */
export const getUserTrips = cache(
  async (status?: string, page: number = 1, limit: number = 10) => {
    try {
      const userId = await requireUserId();

      const filters = userTripsFilterSchema.parse({
        status: status?.trim() || undefined,
      });
      const pagination = paginationSchema.parse({ page, limit });

      const where = {
        userId,
        status: filters.status,
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
 * Aggregates statistics over the user's trips: how many trips, how many distinct
 * countries, and how many distinct destinations.
 *
 * Counts every trip, not just the finished ones. Restricting it to generated
 * trips meant "Trips Planned" disagreed with the number of trips the user could
 * actually see, and a trip that was still generating did not count as planned at
 * all.
 *
 * @returns {Promise<{success: boolean, message?: string, tripsCount?: number, countries?: number, cities?: number}>} The result of the operation including the calculated metrics.
 */
export const getUserStatistics = cache(async () => {
  try {
    const userId = await requireUserId();
    const where = { userId };

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

/**
 * Permanently deletes one of the caller's trips.
 *
 * Scoped with `deleteMany` on `{ id, userId }` so an id that belongs to someone
 * else deletes nothing rather than throwing - the caller learns only that it did
 * not match. Days and activities go with it through the schema's cascade.
 *
 * @param {string} tripId - The trip to delete.
 * @returns {Promise<{success: boolean, message: string}>} The result of the operation.
 */
export async function deleteTrip(tripId: string) {
  try {
    const userId = await requireUserId();

    const rateLimit = checkRateLimit(`delete-trip:${userId}`, {
      limit: 20,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new UserFacingError(
        "Too many delete requests. Please try again later.",
      );
    }

    const id = tripIdSchema.parse(tripId);

    const deleted = await prisma.trip.deleteMany({ where: { id, userId } });

    if (deleted.count === 0) {
      throw new UserFacingError("Trip not found");
    }

    revalidatePath("/");

    return { success: true as const, message: "Trip deleted" };
  } catch (error) {
    return { success: false as const, message: formatError(error) };
  }
}

/**
 * Renames a trip. The title is display-only - `destination` stays the field the
 * itinerary is generated from, so renaming a trip cannot change what was planned.
 *
 * @param {string} tripId - The trip to rename.
 * @param {string} title - The new title.
 * @returns {Promise<{success: boolean, message: string}>} The result of the operation.
 */
export async function renameTrip(tripId: string, title: string) {
  try {
    const userId = await requireUserId();

    const rateLimit = checkRateLimit(`rename-trip:${userId}`, {
      limit: 20,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new UserFacingError(
        "Too many rename requests. Please try again later.",
      );
    }

    const parsed = renameTripSchema.parse({ tripId, title });

    const updated = await prisma.trip.updateMany({
      where: { id: parsed.tripId, userId },
      data: { title: parsed.title },
    });

    if (updated.count === 0) {
      throw new UserFacingError("Trip not found");
    }

    revalidatePath("/");
    revalidatePath(`/trip/${parsed.tripId}`);

    return { success: true as const, message: "Trip renamed" };
  } catch (error) {
    return { success: false as const, message: formatError(error) };
  }
}

/**
 * Re-runs generation for a trip that failed, or that was never started.
 *
 * The existing days are removed first: `Day` is unique on `(tripId, dayNumber)`,
 * so a second run over a partially written itinerary would fail on the first
 * duplicate day instead of replacing it. The reset to `draft` is what makes the
 * trip claimable again by `startTripGeneration`.
 *
 * @param {string} tripId - The trip to regenerate.
 * @returns {Promise<{success: boolean, message: string}>} The result of the operation.
 */
export async function retryGeneration(tripId: string) {
  try {
    const userId = await requireUserId();

    const rateLimit = checkRateLimit(`retry-trip:${userId}`, {
      limit: 5,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new UserFacingError(
        "Too many generation requests. Please try again later.",
      );
    }

    const id = tripIdSchema.parse(tripId);

    const trip = await prisma.trip.findFirst({
      where: { id, userId },
      select: { status: true },
    });

    if (!trip) {
      throw new UserFacingError("Trip not found");
    }

    if (trip.status === "generating") {
      throw new UserFacingError("This trip is already being generated.");
    }

    // One transaction: a reset that clears the days but leaves the status alone
    // would strand the trip with an empty itinerary and a `generated` badge.
    await prisma.$transaction([
      prisma.day.deleteMany({ where: { tripId: id } }),
      prisma.trip.updateMany({
        where: { id, userId },
        data: { status: "draft" },
      }),
    ]);

    const generation = await startTripGeneration(id, userId);

    if (generation.status !== "started") {
      throw new UserFacingError(
        "Could not start generation. Please try again.",
      );
    }

    revalidatePath("/");
    revalidatePath(`/trip/${id}`);

    return { success: true as const, message: "Generation restarted" };
  } catch (error) {
    return { success: false as const, message: formatError(error) };
  }
}

/**
 * Saves the order the user arranged one day into.
 *
 * The arrangement used to live in the query string, so it was lost on the next
 * visit and pushed a comma-separated id list per day into the URL.
 *
 * @param {string} dayId - The day being rearranged.
 * @param {string[]} orderedActivityIds - Every activity of that day, in the new order.
 * @returns {Promise<{success: boolean, message: string}>} The result of the operation.
 */
export async function reorderDayActivities(
  dayId: string,
  orderedActivityIds: string[],
) {
  try {
    const userId = await requireUserId();

    const rateLimit = checkRateLimit(`reorder-day:${userId}`, {
      limit: 60,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new UserFacingError(
        "Too many reorder requests. Please try again later.",
      );
    }

    const parsed = reorderDaySchema.parse({
      dayId,
      activityIds: orderedActivityIds,
    });

    // Ownership is checked through the trip, not the day: `Day` has no `userId`
    // of its own, so filtering on the relation is what stops a caller from
    // rearranging somebody else's itinerary.
    const day = await prisma.day.findFirst({
      where: { id: parsed.dayId, trip: { userId } },
      select: { tripId: true, activities: { select: { id: true } } },
    });

    if (!day) {
      throw new UserFacingError("Day not found");
    }

    // The submitted list has to be exactly this day's activities. A subset would
    // leave the rest holding stale positions, and an id from another day would
    // be written here on the strength of a check it never passed.
    const existingIds = new Set(day.activities.map((activity) => activity.id));
    const matchesDay =
      parsed.activityIds.length === existingIds.size &&
      parsed.activityIds.every((id) => existingIds.has(id));

    if (!matchesDay) {
      throw new UserFacingError(
        "This day has changed since you started reordering. Please reload.",
      );
    }

    await prisma.$transaction(
      parsed.activityIds.map((id, index) =>
        prisma.activity.update({
          where: { id },
          data: { userOrder: index + 1 },
        }),
      ),
    );

    revalidatePath(`/trip/${day.tripId}`);

    return { success: true as const, message: "Order saved" };
  } catch (error) {
    return { success: false as const, message: formatError(error) };
  }
}
