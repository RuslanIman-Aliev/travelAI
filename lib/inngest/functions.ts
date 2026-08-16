import { prisma } from "@/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NonRetriableError } from "inngest";
import { parseCostString } from "../cost";
import { getAIPrompt, getPhotoByDestination } from "../utils";
import type { AIActivity, AIDay } from "../types";
import { aiTripResponseSchema } from "../validators";
import { inngest } from "./client";

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
 * Resolves an activity's coordinates, returning nulls unless the pair is complete
 * and geographically valid. Computed once per activity rather than per column.
 *
 * @param {AIActivity} activity - An activity from the model response.
 * @returns {{latitude: number|null, longitude: number|null}} The validated pair.
 */
const toCoordinates = (activity: AIActivity) => {
  const latitude = toNumberOrNull(activity.latitude);
  const longitude = toNumberOrNull(activity.longitude);

  if (
    latitude == null ||
    longitude == null ||
    !isValidCoordinate(latitude, longitude)
  ) {
    return { latitude: null, longitude: null };
  }

  return { latitude, longitude };
};

/**
 * Maps one model activity onto the columns persisted for it, parsing its
 * free-text cost into minor units here - the single ingestion point - so no
 * regex has to run at render time.
 *
 * @param {AIActivity} activity - An activity from the model response.
 * @param {number} index - Zero-based position within its day.
 * @returns {object} A Prisma `Activity` create payload.
 */
const toActivityCreateInput = (activity: AIActivity, index: number) => {
  const cost = parseCostString(
    activity.estimatedCost ?? activity.ticket_pricing,
  );
  const { latitude, longitude } = toCoordinates(activity);

  return {
    order: index + 1,
    time: activity.time,
    title: activity.title?.trim() || activity.placeName?.trim() || "Activity",
    placeName: activity.placeName?.trim() || activity.title?.trim(),
    description: activity.description,
    placeType: activity.placeType,
    estimatedCostCents: cost.cents,
    estimatedCostCurrency: cost.currency,
    estimatedCostIsFree: cost.isFree,
    latitude,
    longitude,
  };
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

    const trip = await step.run("fetch-trip", async () =>
      prisma.trip.findUnique({ where: { id: tripId } }),
    );

    if (!trip) {
      throw new NonRetriableError(`Trip not found: ${tripId}`);
    }

    const aiResult = await step.run("generate-itinerary", async () => {
      const tripWithDates = {
        ...trip,
        startDate: new Date(trip.startDate),
        endDate: new Date(trip.endDate),
        createdAt: new Date(trip.createdAt),
        updatedAt: new Date(trip.updatedAt),
      };
      const prompt = getAIPrompt({ trip: tripWithDates });

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("AI response was not valid JSON");
      }

      if (
        json &&
        typeof json === "object" &&
        typeof (json as { error?: unknown }).error === "string"
      ) {
        return { error: (json as { error: string }).error };
      }

      const parsed = aiTripResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error("AI response did not match itinerary schema");
      }

      return parsed.data;
    });

    if ("error" in aiResult) {
      await step.run("handle-invalid-location", async () => {
        await prisma.trip.update({
          where: { id: tripId },
          data: { status: "failed", aiGenerated: false },
        });
      });

      throw new NonRetriableError(`Invalid Location: ${aiResult.error}`);
    }

    // Fetched before the write so a Pexels outage cannot roll back, or partially
    // apply, the itinerary itself.
    const destinationImage = await step.run(
      "fetch-destination-photo",
      async () => getPhotoByDestination(trip.destination),
    );

    await step.run("save-itinerary", async () => {
      // A single transaction so a retry of this step can never leave a trip with
      // days but no `generated` status. `Day` also carries a unique constraint on
      // (tripId, dayNumber), so a duplicate run fails loudly instead of doubling
      // every day in the itinerary.
      await prisma.$transaction([
        ...aiResult.itinerary.map((day: AIDay) =>
          prisma.day.create({
            data: {
              tripId,
              dayNumber: day.dayNumber,
              date: new Date(day.date),
              summary: day.summary,
              activities: {
                create: day.activities.map(toActivityCreateInput),
              },
            },
          }),
        ),
        prisma.trip.update({
          where: { id: tripId },
          data: {
            aiGenerated: true,
            status: "generated",
            imageUrl: destinationImage,
          },
        }),
      ]);
    });

    return { success: true, tripId };
  },
);
