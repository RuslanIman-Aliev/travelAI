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

    const newTrip =await prisma.trip.create({
      data: {
        destination: tripData.destination,
        startDate: tripData.startDate, 
        endDate: tripData.endDate,
        interests: tripData.interests,
        budget,
        daysCount,
        userId: session.user.id,
      },
    });
    return { success: true, message: "Trip created successfully" , tripId: newTrip.id };
  } catch (error) {
    return { success: false, message: formatError(error) || "An unexpected error occurred" };
  }
}
