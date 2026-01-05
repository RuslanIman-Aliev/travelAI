import z from "zod";

// Define a Zod schema for a Trip Details

export const insertTripSchema = z.object({
  destination: z.string().min(1, "Destination is required"),
  startDate: z.date(),
  endDate: z.date(),
  interests: z.array(z.string()).optional(),
  budget: z.array(z.number()).min(2).max(2).optional(),
});