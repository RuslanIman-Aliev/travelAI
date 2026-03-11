"use server";

import { auth } from "@/auth";
import { insertTripSchema } from "@/lib/validators";
import { prisma } from "@/prisma";
import z from "zod";
import { formatError } from "../utils";

export async function insertTrip(data: z.infer<typeof insertTripSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
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
        userId: session.user.id,
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

export async function getUserTrips(
  userId: string,
  status?: string,
  isGenerated?: boolean,
) {
  try {
    const trips = await prisma.trip.findMany({
      where: {
        userId: userId,
        status: status ? status : undefined,
        aiGenerated: isGenerated,
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

export async function getUserStatictics(userId: string) {
  try {
    const tripsCount = await prisma.trip.count({
      where: {
        userId: userId,
        aiGenerated: true,
      },
    });
    const countries = await prisma.trip.findMany({
      where: {
        userId: userId,
        aiGenerated: true,
      },
      distinct: ["country"],
      select: {
        country: true,
      },
    });
    const cities = await prisma.trip.findMany({
      where: {
        userId: userId,
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
