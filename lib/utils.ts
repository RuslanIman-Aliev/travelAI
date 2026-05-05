import { Prisma, type Trip } from "@prisma/client";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PEXELS_API_KEY } from "./variables";
import { ZodError } from "zod";

/**
 * Utility function to conditionally merge Tailwind CSS classes using `clsx` and `tailwind-merge`.
 * Ensures overriding classes are resolved correctly.
 *
 * @param {...ClassValue[]} inputs - Any number of class values (strings, arrays, objects) to combine.
 * @returns {string} The computed final CSS class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats various errors (Zod validation, Prisma, generic errors) into a user-friendly string message.
 *
 * @param {unknown} error - The error object caught in a try/catch block.
 * @returns {string} A human-readable error message.
 */
export function formatError(error: unknown): string {
  // 1. Handle Zod Errors
  if (error instanceof ZodError) {
    const fieldErrors = error.issues.map((issue) => issue.message);
    return fieldErrors.length > 0
      ? fieldErrors.join(". ")
      : "Validation failed";
  }

  // 2. Handle Prisma Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const meta = error.meta as { target?: string[] };
      const field = meta?.target ? meta.target[0] : "Field";
      return `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    }
  }

  if (error instanceof Error) return error.message;

  return "An unexpected error occurred";
}

/**
 * Generates an AI prompt string from trip details to pass to an LLM for generating a travel itinerary.
 *
 * @param {{trip: Trip}} param0 - An object containing the trip details (requires destination, country, dates, budget, etc.).
 * @returns {string} The constructed prompt containing trip requirements and JSON schema enforcement instructions.
 */
export function getAIPrompt({ trip }: { trip: Trip }) {
  // We format the dates nicely for the AI
  const formattedDates = `${new Date(
    trip.startDate,
  ).toDateString()} to ${new Date(trip.endDate).toDateString()}`;

  return `
You are an expert local travel guide and budget planner.
Create a detailed, day-by-day travel itinerary for the following trip:

TRIP DETAILS:
- **Destination**: ${trip.destination}
- **Country**: ${trip.country}
- **Dates**: ${formattedDates} (${trip.daysCount} days)
- **Traveler Interests**: ${
    trip.interests?.join(", ") || "General sightseeing, Local culture"
  }
- **Total Budget**: ${
    trip.budget
      ? `${trip.budget} (Currency of the destination)`
      : "Moderate/Standard"
  }

CRITICAL INSTRUCTIONS:
1. **Budget Enforcement**: The user has a budget of ${trip.budget}. 
   - If the budget is LOW: Suggest street food, free walking tours, public parks, and public transport. Avoid expensive tickets.
   - If the budget is HIGH: Suggest fine dining, private tours, and exclusive experiences.
   - **Important**: The activities suggested must NOT exceed this total budget when summed up.

2. **Cost Field Required**:
  - Every activity MUST include "estimatedCost".
  - Use "Free" when there is no cost.
  - Otherwise use a short string with amount and currency (e.g., "20 EUR").
  - Do not omit or leave "estimatedCost" empty.

3. **Realism**: 
   - Group activities geographically to minimize travel time.
   - Include lunch and dinner stops in logical locations.
   - Use REAL, EXISTING places.

4. **Response Format**: 
   - You must output ONLY valid JSON. 
    - Do not include markdown code blocks (like JSON fenced blocks). 
   - Do not include introductory text.

5. **Geolocation Accuracy**:
   - Ensure all GPS coordinates ('lat', 'lng') are ACCURATE and located specifically within **${
     trip.destination
   }**.
   - Do NOT guess coordinates. If you are unsure, set them to '0'.
   - Double-check that latitude and longitude signs (+/-) are correct for this specific region.
   
6. **Location Validation**:
   - Check if the **Destination** ("${trip.destination}") is a real, recognizable city or region on Earth.
   - If the input is gibberish (e.g., "sdfdsf"), a random string, or a place that does not exist:
     RETURN ONLY THIS JSON: { "error": "Location not found" }
{
  "title": "...",
  "currency": "...",
  "itinerary": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "summary": "...",
      "activities": [
        {
          "time": "HH:MM",
          "title": "Exact name of the place", 
          "placeName": "Exact name of the place", 
          "placeType": One of: [Sightseeing, Food, Relax, Adventure, Shopping, Culture]
          "description": "Max 10 words. Keywords only.",
          "latitude": 0.0, (Must be exact latitude for this place) 
          "longitude": 0.0, (Must be exact longitude for this place) 
          "estimatedCost": "Estimated cost (e.g. 'Free' or '20 EUR')",
        }
      ]
    }
  ]
}
`;
}

/**
 * Fetches a representative landscape photo for a given destination using the Pexels API.
 * Attempts to retrieve a cached version using Next.js `fetch` configuration.
 *
 * @param {string} destination - The name of the city, country, or location to search for.
 * @returns {Promise<string|null|{success: false, message: string}>} The URL of the requested image, null if it is not found, or an error object indicating the photo fetch failed.
 */
export async function getPhotoByDestination(destination: string) {
  try {
    const url =
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        destination,
      )}&per_page=1&orientation=landscape&size=large` ||
      "https://images.pexels.com/photos/268455/pexels-photo-268455.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

    const response = await fetch(url, {
      headers: {
        Authorization: PEXELS_API_KEY || "",
      },
      next: { revalidate: 3600 },
    });

    const data = await response.json();

    if (data.photos && data.photos.length > 0) {
      return data.photos[0].src.large2x;
    }

    return null;
  } catch {
    return { success: false, message: "Failed to fetch photo" };
  }
}
