import z from "zod";

// Define a Zod schema for a Trip Details

export const insertTripSchema = z.object({
  destination: z.string().min(1, "Destination is required"),
  startDate: z.date(),
  endDate: z.date(),
  interests: z.array(z.string()).optional(),
  budget: z.array(z.number()).min(2).max(2).optional(),
});

export const formSchema = z.object({
  location: z.string().min(1, {
    message: "Choose a location by clicking a Use Current Location button",
  }),
  radius: z.string().min(1, { message: "Radius is required" }),
  selectedPlaces: z
    .array(
      z.object({
        id: z.string(),
        address: z.string(),
        name: z.string(),
        category: z.string(),
        rating: z.number(),
        userRatingCount: z.number(),
        location: z.object({
          lat: z.number(),
          lng: z.number(),
        }),
      })
    )
    // .min(1, { message: "Select at least one place to visit" }),
});
