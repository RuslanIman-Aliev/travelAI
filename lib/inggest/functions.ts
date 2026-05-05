import { prisma } from "@/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NonRetriableError } from "inngest";
import { getAIPrompt, getPhotoByDestination } from "../utils";
import { inngest } from "./client";
import { AIDay, AIActivity } from "../types";
import { aiTripResponseSchema } from "../validators";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  generationConfig: {
    responseMimeType: "application/json",
  },
});

/**
 * Converts various optional types to a strict number or null.
 * Helps prevent NaN bugs by coalescing empty/invalid strings to a predictable null.
 *
 * @param {string|number|null} [value] - The value to cast.
 * @returns {number|null} Converted continuous number, or null if incompatible.
 */
const toNumberOrNull = (value?: string | number | null) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Validates whether a provided set of coordinates falls within real-world geographic bounds.
 *
 * @param {number} lat - Latitude bounded from -90 to 90.
 * @param {number} lng - Longitude bounded from -180 to 180.
 * @returns {boolean} Indicates if the coordinate pair is structurally valid.
 */
const isValidCoordinate = (lat: number, lng: number) =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

/**
 * Normalizes string-based activity price estimations into formatted generic descriptions.
 * Standardizes empty logic into "N/A" and "Free" keywords.
 *
 * @param {AIActivity} activity - An activity output from the AI iteration context.
 * @returns {string} Text representing normalized and verified cost strings.
 */
const normalizeCost = (activity: AIActivity) => {
  const raw = activity.estimatedCost ?? activity.ticket_pricing;
  if (!raw) return "N/A";

  const trimmed = raw.trim();
  if (!trimmed) return "N/A";

  const lower = trimmed.toLowerCase();
  if (lower.includes("free") || lower.includes("no cost")) return "Free";
  return trimmed;
};

/**
 * Defines the main Inngest serverless function to invoke Google Gemini,
 * retrieve an itinerary, validate data, and synchronize it back with the database.
 * Triggers async whenever 'trip.generate' event signals.
 *
 * @type {import('inngest').InngestFunction}
 */
export const generateTripFunction = inngest.createFunction(
  {
    id: "generate-trip-itinerary",
    triggers: [{ event: "trip.generate" }],
  },
  async ({ event, step }) => {
    const { tripId } = event.data;

    const trip = await step.run("fetch-trip", async () => {
      return await prisma.trip.findUnique({
        where: { id: tripId },
      });
    });

    if (!trip) {
      throw new Error("Trip not found");
    }
    // Here  calling an AI service
    const aiResult = await step.run("generate-itinerary", async () => {
      const tripWithDates = {
        ...trip,
        startDate: new Date(trip.startDate),
        endDate: new Date(trip.endDate),
        createdAt: new Date(trip.createdAt),
        updatedAt: new Date(trip.updatedAt),
      };
      const prompt = getAIPrompt({ trip: tripWithDates });

      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const json = JSON.parse(text);

        if (typeof json?.error === "string") {
          return { error: json.error };
        }

        const parsed = aiTripResponseSchema.safeParse(json);

        if (!parsed.success) {
          throw new Error("AI response did not match itinerary schema");
        }

        return parsed.data;
      } catch {
        throw new Error("Failed to generate valid JSON from AI");
      }
    });

    if ("error" in aiResult) {
      await step.run("handle-invalid-location", async () => {
        await prisma.trip.update({
          where: { id: tripId },
          data: {
            status: "failed",
            aiGenerated: false,
          },
        });
      });

      throw new NonRetriableError(`Invalid Location: ${aiResult.error}`);
    }

    await step.run("save-itinerary", async () => {
      const itinerary = aiResult.itinerary;

      await prisma.$transaction(
        itinerary.map((day: AIDay) =>
          prisma.day.create({
            data: {
              tripId: tripId,
              dayNumber: day.dayNumber,
              date: new Date(day.date),
              summary: day.summary,

              activities: {
                create: day.activities.map(
                  (activity: AIActivity, index: number) => ({
                    order: index + 1,
                    time: activity.time,

                    title:
                      activity.title?.trim() ||
                      activity.placeName?.trim() ||
                      "Activity",
                    placeName:
                      activity.placeName?.trim() || activity.title?.trim(),

                    description: activity.description,
                    placeType: activity.placeType,
                    estimatedCost: normalizeCost(activity),

                    latitude: (() => {
                      const lat = toNumberOrNull(activity.latitude);
                      const lng = toNumberOrNull(activity.longitude);
                      if (lat == null || lng == null) return null;
                      return isValidCoordinate(lat, lng) ? lat : null;
                    })(),
                    longitude: (() => {
                      const lat = toNumberOrNull(activity.latitude);
                      const lng = toNumberOrNull(activity.longitude);
                      if (lat == null || lng == null) return null;
                      return isValidCoordinate(lat, lng) ? lng : null;
                    })(),
                  }),
                ),
              },
            },
          }),
        ),
      );
      const destinationImage = await getPhotoByDestination(trip.destination);
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          aiGenerated: true,
          status: "generated",
          imageUrl: destinationImage || null,
        },
      });
    });

    return { success: true };
  },
);
