/* eslint-disable @typescript-eslint/no-explicit-any */

"use server";

import { prisma } from "@/prisma";
import { formatError } from "../utils";

export async function saveLiveGuideRoute(userId: string, data: any) {
  try {
    const { location, coords, radiusNumber, selectedPlaces, mapLink } = data;
    await prisma.liveGuide.create({
      data: {
        userId,
        startAddress: location,
        startLat: coords.lat,
        startLng: coords.lng,
        mapLink: mapLink,
        radiusMeters: radiusNumber,
        places: {
          create: selectedPlaces.map((place: any, index: number) => ({
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
