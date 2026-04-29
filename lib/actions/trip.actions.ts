"use server";

import { auth } from "@/auth";
import { insertTripSchema, userTripsFilterSchema } from "@/lib/validators";
import { prisma } from "@/prisma";
import z from "zod";
import { formatError } from "../utils";
import { checkRateLimit } from "../security";

const getAuthenticatedUserId = async () => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
};

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

export async function getTripById(tripId: string) {
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
}

export async function getUserTrips(status?: string, isGenerated?: boolean) {
  try {
    const userId = await getAuthenticatedUserId();
    const filters = userTripsFilterSchema.parse({
      status: status?.trim() || undefined,
      isGenerated,
    });

    const trips = await prisma.trip.findMany({
      where: {
        userId,
        status: filters.status,
        aiGenerated: filters.isGenerated,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, trips };
  } catch (error) {
    return {
      success: false,
      message: formatError(error) || "An unexpected error occurred",
    };
  }
}

export async function getUserStatictics() {
  try {
    const userId = await getAuthenticatedUserId();
    const tripsCount = await prisma.trip.count({
      where: {
        userId,
        aiGenerated: true,
      },
    });
    const countries = await prisma.trip.findMany({
      where: {
        userId,
        aiGenerated: true,
      },
      distinct: ["country"],
      select: {
        country: true,
      },
    });
    const cities = await prisma.trip.findMany({
      where: {
        userId,
        aiGenerated: true,
      },
      distinct: ["destination"],
      select: {
        destination: true,
      },
    });
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
}
