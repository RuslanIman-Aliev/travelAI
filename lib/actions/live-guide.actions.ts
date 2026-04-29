"use server";

import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { checkRateLimit } from "../security";
import { liveGuideRouteSchema } from "../validators";
import { formatError } from "../utils";
import { GooglePlace, LiveRouteData } from "../types";

export async function saveLiveGuideRoute(data: LiveRouteData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    const rateLimit = checkRateLimit(`live-guide:${session.user.id}`, {
      limit: 5,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new Error("Too many live guide requests. Please try again later.");
    }

    const { location, coords, radiusNumber, selectedPlaces, mapLink } =
      liveGuideRouteSchema.parse(data);

    await prisma.liveGuide.create({
      data: {
        userId: session.user.id,
        startAddress: location,
        startLat: coords.lat,
        startLng: coords.lng,
        mapLink: mapLink,
        radiusMeters: radiusNumber,
        places: {
          create: selectedPlaces.map((place: GooglePlace, index: number) => ({
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
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatError(error) || "Failed to save live guide route.",
    };
  }
}
