import { prisma } from "@/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NonRetriableError } from "inngest";
import { getAIPrompt, getPhotoByDestination } from "../utils";
import { inngest } from "./client";
import { Activity} from "@prisma/client";
import { AIDay } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  generationConfig: {
    responseMimeType: "application/json",
  },
});

export const generateTripFunction = inngest.createFunction(
  { id: "generate-trip-itinerary" },
  { event: "trip.generate" },
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

        return json;
      } catch (error) {
        throw new Error("Failed to generate valid JSON from AI");
      }
    });

    if (aiResult.error) {
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
                  (activity: Activity, index: number) => ({
                    order: index + 1,
                    time: activity.time,

                    title: activity.title ?? activity.placeName ?? "Activity",
                    placeName: activity.placeName,

                    description: activity.description,
                    placeType: activity.placeType,
                    estimatedCost: activity.estimatedCost,

                    latitude: activity.latitude
                      ? Number(activity.latitude)
                      : null,
                    longitude: activity.longitude
                      ? Number(activity.longitude)
                      : null,
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
