import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Trip } from "@prisma/client";
import { ca } from "date-fns/locale";
import { PEXELS_API_KEY } from "./variables";
import { success } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatError(error: any) {
  if (error.name === "ZodError") {
    let issues = error.errors || error.issues || [];

    if (issues.length === 0 && typeof error.message === "string") {
      try {
        const parsed = JSON.parse(error.message);
        if (Array.isArray(parsed)) {
          issues = parsed;
        }
      } catch {}
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldErrors = issues.map((e: any) => e.message);

    if (fieldErrors.length > 0) {
      return fieldErrors.join(". ");
    }

    return "Validation failed";
  } else if (
    error.name === "PrismaClientKnownRequestError" &&
    error.code === "P2002"
  ) {
    const field = error.meta?.target ? error.meta.target[0] : "Field";
    return `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  } else {
  }
}

export function getAIPrompt({ trip }: { trip: Trip }) {
  // We format the dates nicely for the AI
  const formattedDates = `${new Date(
    trip.startDate
  ).toDateString()} to ${new Date(trip.endDate).toDateString()}`;

  return `
You are an expert local travel guide and budget planner.
Create a detailed, day-by-day travel itinerary for the following trip:

TRIP DETAILS:
- **Destination**: ${trip.destination}
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

2. **Realism**: 
   - Group activities geographically to minimize travel time.
   - Include lunch and dinner stops in logical locations.
   - Use REAL, EXISTING places.

3. **Response Format**: 
   - You must output ONLY valid JSON. 
   - Do not include markdown code blocks (like \`\`\`json). 
   - Do not include introductory text.

JSON STRUCTURE TO FOLLOW:

{
  "trip_title": "A catchy name for this trip (e.g., 'Parisian Art & Food Escape')",
  "currency": "The local currency code (e.g., EUR, USD, JPY)",
  "itinerary": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "theme": "A short 2-3 word theme for the day (e.g. 'Ancient History')",
      "summary": "A 1-sentence summary of what makes this day special.",
      "activities": [
        {
          "time": "HH:MM (24h format)",
          "place_name": "Exact name of the place/restaurant",
          "category": "One of: [Sightseeing, Food, Relax, Adventure, Shopping, Culture]",
          "description": "Engaging 1-sentence description focusing on why this matches user interests.",
          "geo_coordinates": {
             "lat": 0.00,
             "lng": 0.00
          },
          "ticket_pricing": "Estimated cost (e.g. 'Free' or '20 EUR')",
          "rating": "Estimated rating 1-5"
        }
      ]
    }
  ]
}
`;
}

export async function getPhotoByDestination(destination: string) {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
      destination
    )}&per_page=1&orientation=landscape&size=large`;

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
  } catch (error) {
    
    return {success: false, message: "Failed to fetch photo"};
  }
}
