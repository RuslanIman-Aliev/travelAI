import z from 'zod';

// Define a Zod schema for a Trip Details

export const insertTripSchema = z.object({
  destination: z.string().min(1, "Destination is required"),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid start date",
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid end date",
  }),
  interests: z.array(z.string()).optional()
});