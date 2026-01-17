/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NonRetriableError } from "inngest";
import { getAIPrompt, getPhotoByDestination } from "../utils";
import { inngest } from "./client";

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
        itinerary.map((day: any) =>
          prisma.day.create({
            data: {
              tripId: tripId,
              dayNumber: day.day,
              date: new Date(day.date),
              summary: day.summary,

              activities: {
                create: day.activities.map((activity: any, index: number) => ({
                  order: index + 1,
                  time: activity.time,

                  title: activity.place_name,
                  placeName: activity.place_name,

                  description: activity.description,
                  placeType: activity.category,
                  estimatedCost: activity.ticket_pricing,

                  latitude: activity.geo_coordinates?.lat
                    ? Number(activity.geo_coordinates.lat)
                    : null,
                  longitude: activity.geo_coordinates?.lng
                    ? Number(activity.geo_coordinates.lng)
                    : null,
                })),
              },
            },
          })
        )
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
  }
);
